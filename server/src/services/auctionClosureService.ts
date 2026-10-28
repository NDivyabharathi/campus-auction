import mongoose from 'mongoose';
import { Auction } from '../models/Auction.js';
import { Bid } from '../models/Bid.js';
import { Transaction } from '../models/Transaction.js';
import { broadcastAuctionUpdate, getIO } from '../socket.js';
import { createNotification } from './notificationService.js';
import { scanAndExpireWants, checkNewListingMatches } from './wantService.js';

export const activateScheduledAuction = async (auctionId: string): Promise<any> => {
  try {
    const now = new Date();
    const updated = await Auction.findOneAndUpdate(
      {
        _id: auctionId,
        status: 'scheduled',
        startTime: { $lte: now },
        closingAt: { $gt: now },
      },
      {
        $set: { status: 'active' },
      },
      { new: true }
    )
      .populate('sellerId', 'fullName department year createdAt')
      .populate('currentLeadingBidderId', 'fullName');

    if (updated) {
      console.log(`[Auction Activation] Scheduled auction "${updated.title}" is now LIVE.`);
      
      // Dedicated event for auction detail listeners
      broadcastAuctionUpdate(updated._id.toString(), 'auction_opened', {
        auctionId: updated._id.toString(),
        status: 'active',
        startTime: updated.startTime,
        closingAt: updated.closingAt,
      });

      // Global auction_opened broadcast
      const io = getIO();
      if (io) {
        io.emit('auction_opened', {
          auctionId: updated._id.toString(),
          status: 'active',
          startTime: updated.startTime,
          closingAt: updated.closingAt,
        });
      }

      // Global marketplace update event
      broadcastAuctionUpdate(updated._id.toString(), 'marketplace_update', {
        auctionId: updated._id.toString(),
        event: 'auction_opened',
        data: {
          status: 'active',
          startTime: updated.startTime,
          closingAt: updated.closingAt,
        },
      });

      // Scan and alert active saved wants matching this newly activated listing
      checkNewListingMatches(updated).catch((err) =>
        console.error('[Want Matching Error on Scheduled Activation]', err)
      );
    }
    return updated;
  } catch (err) {
    console.error(`[Auction Activation Error] Failed to activate auction ${auctionId}:`, err);
    return null;
  }
};

export const processAuctionClosure = async (auctionId: string): Promise<any> => {
  try {
    const auction = await Auction.findById(auctionId);
    if (!auction) return null;

    const now = new Date();

    // If auction is not active and not an expired scheduled auction, don't re-process
    if (
      auction.status !== 'active' &&
      !(auction.status === 'scheduled' && new Date(auction.closingAt).getTime() <= now.getTime())
    ) {
      return auction;
    }

    // Anti-Sniping Protection: if auction was extended into the future by a last-minute bid, abort closure
    if (new Date(auction.closingAt).getTime() > now.getTime()) {
      return auction;
    }

    // Find highest valid bid
    const highestBid = await Bid.findOne({ auctionId: auction._id })
      .sort({ amount: -1, createdAt: 1 })
      .populate('bidderId', 'fullName email department year');

    if (!highestBid) {
      // No bids placed -> Atomically mark unsold if still expired and active/scheduled
      const updated = await Auction.findOneAndUpdate(
        {
          _id: auction._id,
          status: { $in: ['active', 'scheduled'] },
          closingAt: { $lte: now },
        },
        {
          $set: { status: 'unsold' },
        },
        { new: true }
      );

      if (!updated) {
        // Auction was extended or closed concurrently
        return auction;
      }

      broadcastAuctionUpdate(auction._id.toString(), 'auction_ended', {
        auctionId: auction._id,
        status: 'unsold',
        message: 'Auction closed with no bids.',
      });

      // Notify seller that auction ended without bids
      await createNotification({
        recipientId: auction.sellerId.toString(),
        type: 'auction_unsold',
        title: 'Auction Ended (Unsold)',
        message: `Your listing "${auction.title}" closed without any bids.`,
        auctionId: auction._id,
        deduplicationKey: `auction_unsold_${auction._id}`,
      });

      return updated;
    }

    // Has winning bidder -> Atomically reserve item if still expired and active
    const winnerId = ((highestBid.bidderId as any)._id || highestBid.bidderId).toString();
    const winnerName = (highestBid.bidderId as any).fullName || 'Kongu Student';

    const updated = await Auction.findOneAndUpdate(
      {
        _id: auction._id,
        status: 'active',
        closingAt: { $lte: now },
      },
      {
        $set: {
          status: 'reserved',
          currentLeadingBid: highestBid.amount,
          currentLeadingBidderId: new mongoose.Types.ObjectId(winnerId),
        },
      },
      { new: true }
    );

    if (!updated) {
      // Auction was extended or closed concurrently
      return auction;
    }

    // Idempotently check for existing transaction
    let transaction = await Transaction.findOne({
      auctionId: auction._id,
      status: { $in: ['awaiting_handover', 'handover_scheduled', 'completed'] },
    });

    if (!transaction) {
      const reservationHours = 24; // 24 hours deadline to arrange handover
      const reservationDeadline = new Date(Date.now() + reservationHours * 60 * 60 * 1000);

      transaction = await Transaction.create({
        auctionId: auction._id,
        sellerId: auction.sellerId,
        buyerId: new mongoose.Types.ObjectId(winnerId),
        amount: highestBid.amount,
        status: 'awaiting_handover',
        reservationDeadline,
        attemptNumber: 1,
      });

      console.log(
        `[Auction Closure] Auction "${auction.title}" closed. Winner: ${winnerName} for ₹${highestBid.amount}. Reservation created.`
      );
    }

    broadcastAuctionUpdate(auction._id.toString(), 'auction_ended', {
      auctionId: auction._id,
      status: 'reserved',
      winningAmount: highestBid.amount,
      winner: highestBid.bidderId,
      transactionId: transaction._id,
    });

    // 1. Notify Seller that item was sold
    await createNotification({
      recipientId: auction.sellerId.toString(),
      type: 'auction_sold',
      title: 'Auction Won! Item Reserved',
      message: `"${auction.title}" was won by ${winnerName} for ₹${highestBid.amount}. Please propose or confirm campus handover.`,
      auctionId: auction._id,
      transactionId: transaction._id,
      actorId: new mongoose.Types.ObjectId(winnerId),
      deduplicationKey: `auction_sold_${auction._id}`,
    });

    // 2. Notify Winner that they won
    await createNotification({
      recipientId: winnerId,
      type: 'auction_won',
      title: 'You Won the Auction! 🎉',
      message: `Congratulations! You won "${auction.title}" for ₹${highestBid.amount}. Coordinate campus handover now.`,
      auctionId: auction._id,
      transactionId: transaction._id,
      actorId: auction.sellerId,
      deduplicationKey: `auction_won_${auction._id}`,
    });

    // 3. Notify other distinct bidders that the auction has concluded
    try {
      const otherBidders = await Bid.find({
        auctionId: auction._id,
        bidderId: {
          $ne: new mongoose.Types.ObjectId(winnerId),
        },
      }).distinct('bidderId');

      for (const otherBidderId of otherBidders) {
        if (!otherBidderId.equals(auction.sellerId)) {
          await createNotification({
            recipientId: otherBidderId.toString(),
            type: 'auction_lost',
            title: 'Auction Concluded',
            message: `The auction for "${auction.title}" has concluded. The winning bid was ₹${highestBid.amount}.`,
            auctionId: auction._id,
            deduplicationKey: `auction_lost_${auction._id}_${otherBidderId}`,
          });
        }
      }
    } catch (err) {
      console.error('[Auction Closure] Error notifying other bidders:', err);
    }

    return updated;
  } catch (error) {
    console.error(`[Auction Closure Error] Failed to close auction ${auctionId}:`, error);
    return null;
  }
};

// Periodic background worker that scans for expired auctions and ending-soon auctions
let closureInterval: NodeJS.Timeout | null = null;

export const startAuctionClosureWorker = (intervalMs = 10000) => {
  if (closureInterval) return;

  closureInterval = setInterval(async () => {
    try {
      const now = new Date();

      // 1. Scan for scheduled auctions ready to activate (startTime <= now)
      const scheduledAuctionsToActivate = await Auction.find({
        status: 'scheduled',
        startTime: { $lte: now },
        closingAt: { $gt: now },
      }).select('_id');

      if (scheduledAuctionsToActivate.length > 0) {
        console.log(`[Worker] Found ${scheduledAuctionsToActivate.length} scheduled auction(s) ready to activate.`);
        for (const auc of scheduledAuctionsToActivate) {
          await activateScheduledAuction(auc._id.toString());
        }
      }

      // 2. Scan for expired active/scheduled auctions to close
      const expiredAuctions = await Auction.find({
        status: { $in: ['active', 'scheduled'] },
        closingAt: { $lte: now },
      }).select('_id');

      if (expiredAuctions.length > 0) {
        console.log(`[Worker] Found ${expiredAuctions.length} expired auction(s) to close.`);
        for (const auc of expiredAuctions) {
          await processAuctionClosure(auc._id.toString());
        }
      }

      // 3. Scan for auctions ending soon (< 5 minutes)
      const endingSoonThreshold = 5 * 60 * 1000; // 5 minutes
      const inFiveMins = new Date(now.getTime() + endingSoonThreshold);

      const endingSoonAuctions = await Auction.find({
        status: 'active',
        closingAt: { $gt: now, $lte: inFiveMins },
      }).select('_id title currentLeadingBid closingAt');

      for (const auc of endingSoonAuctions) {
        // Find all distinct students who have placed a bid on this auction
        const bidderIds = await Bid.find({ auctionId: auc._id }).distinct('bidderId');
        for (const bId of bidderIds) {
          // Send ending-soon alert with deterministic deduplication key
          await createNotification({
            recipientId: bId.toString(),
            type: 'auction_ending_soon',
            title: 'Auction Ending Soon (< 5 mins)',
            message: `"${auc.title}" is closing in less than 5 minutes! Current leading bid is ₹${auc.currentLeadingBid}.`,
            auctionId: auc._id,
            deduplicationKey: `auction_ending_soon_${auc._id}_${bId}`,
          });
        }
      }

      // 4. Scan and mark expired wants (past 30 days)
      await scanAndExpireWants();
    } catch (err) {
      console.error('[Worker Error] Auction closure scanner error:', err);
    }
  }, intervalMs);

  console.log(`[Worker] Automatic Auction Closure worker started (polling every ${intervalMs / 1000}s)`);
};
