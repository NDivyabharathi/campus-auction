import mongoose from 'mongoose';
import { Auction } from '../models/Auction.js';
import { Bid } from '../models/Bid.js';
import { Transaction } from '../models/Transaction.js';
import { broadcastAuctionUpdate } from '../socket.js';

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

      return auction;
    }

    // Has winning bidder -> Reserve item
    auction.status = 'reserved';
    auction.currentLeadingBid = highestBid.amount;
    auction.currentLeadingBidderId = highestBid.bidderId as any;
    await auction.save();

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
        buyerId: (highestBid.bidderId as any)._id || highestBid.bidderId,
        amount: highestBid.amount,
        status: 'awaiting_handover',
        reservationDeadline,
        attemptNumber: 1,
      });

      console.log(
        `[Auction Closure] Auction "${auction.title}" closed. Winner: ${
          (highestBid.bidderId as any).fullName || 'Bidder'
        } for ₹${highestBid.amount}. Reservation created.`
      );
    }

    broadcastAuctionUpdate(auction._id.toString(), 'auction_ended', {
      auctionId: auction._id,
      status: 'reserved',
      winningAmount: highestBid.amount,
      winner: highestBid.bidderId,
      transactionId: transaction._id,
    });

    return auction;
  } catch (error) {
    console.error(`[Auction Closure Error] Failed to close auction ${auctionId}:`, error);
    return null;
  }
};

// Periodic background worker that scans for expired auctions
let closureInterval: NodeJS.Timeout | null = null;

export const startAuctionClosureWorker = (intervalMs = 10000) => {
  if (closureInterval) return;

  closureInterval = setInterval(async () => {
    try {
      const now = new Date();
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
    } catch (err) {
      console.error('[Worker Error] Auction closure scanner error:', err);
    }
  }, intervalMs);

  console.log(`[Worker] Automatic Auction Closure worker started (polling every ${intervalMs / 1000}s)`);
};
