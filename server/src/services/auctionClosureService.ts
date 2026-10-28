import mongoose from 'mongoose';
import { Auction } from '../models/Auction.js';
import { Bid } from '../models/Bid.js';
import { Transaction } from '../models/Transaction.js';
import { broadcastAuctionUpdate } from '../socket.js';
import { createNotification } from './notificationService.js';

export const processAuctionClosure = async (auctionId: string): Promise<any> => {
  try {
    const auction = await Auction.findById(auctionId);
    if (!auction) return null;

    // If auction is already ended/reserved/sold/unsold/cancelled, don't re-process
    if (auction.status !== 'active') {
      return auction;
    }

    // Find highest valid bid
    const highestBid = await Bid.findOne({ auctionId: auction._id })
      .sort({ amount: -1, createdAt: 1 })
      .populate('bidderId', 'fullName email department year');

    if (!highestBid) {
      // No bids placed -> Mark unsold
      auction.status = 'unsold';
      await auction.save();

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

      return auction;
    }

    // Has winning bidder -> Reserve item
    auction.status = 'reserved';
    auction.currentLeadingBid = highestBid.amount;
    auction.currentLeadingBidderId = highestBid.bidderId as any;
    await auction.save();

    const winnerId = ((highestBid.bidderId as any)._id || highestBid.bidderId).toString();
    const winnerName = (highestBid.bidderId as any).fullName || 'Kongu Student';

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

    return auction;
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

      // 1. Scan for expired active auctions to close
      const expiredActiveAuctions = await Auction.find({
        status: 'active',
        closingAt: { $lte: now },
      }).select('_id');

      if (expiredActiveAuctions.length > 0) {
        console.log(`[Worker] Found ${expiredActiveAuctions.length} expired active auctions to close.`);
        for (const auc of expiredActiveAuctions) {
          await processAuctionClosure(auc._id.toString());
        }
      }

      // 2. Scan for auctions ending soon (< 5 minutes)
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
    } catch (err) {
      console.error('[Worker Error] Auction closure scanner error:', err);
    }
  }, intervalMs);

  console.log(`[Worker] Automatic Auction Closure worker started (polling every ${intervalMs / 1000}s)`);
};
