import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Auction } from '../models/Auction.js';
import { Bid } from '../models/Bid.js';
import { Transaction } from '../models/Transaction.js';
import { AuthRequest } from '../middleware/auth.js';
import { broadcastAuctionUpdate } from '../socket.js';
import { processAuctionClosure } from '../services/auctionClosureService.js';

export const placeBid = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rawId = req.params.id;
    const auctionId = Array.isArray(rawId) ? rawId[0] : rawId;
    const { amount } = req.body;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required to place a bid.' });
      return;
    }

    if (!auctionId || !mongoose.Types.ObjectId.isValid(auctionId)) {
      res.status(400).json({ success: false, message: 'Invalid auction ID format.' });
      return;
    }

    const bidAmount = Number(amount);
    if (isNaN(bidAmount) || bidAmount <= 0 || !Number.isInteger(bidAmount)) {
      res.status(400).json({
        success: false,
        message: 'Bid amount must be a valid positive whole rupee amount.',
      });
      return;
    }

    const bidderId = req.user._id;

    // 1. Fetch current auction state
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      res.status(404).json({ success: false, message: 'Auction listing not found.' });
      return;
    }

    // 2. Self-bid prevention rule
    if (auction.sellerId.equals(bidderId)) {
      res.status(403).json({
        success: false,
        message: 'Fairness Violation: You cannot place a bid on your own auction listing.',
      });
      return;
    }

    // 3. Status rule
    if (auction.status !== 'active') {
      res.status(400).json({
        success: false,
        message: `Bidding is closed because this auction is ${auction.status}.`,
      });
      return;
    }

    // 4. Server-authoritative closing time rule
    const now = new Date();
    if (now >= new Date(auction.closingAt)) {
      // Trigger automatic closure immediately
      await processAuctionClosure(auction._id.toString());
      res.status(400).json({
        success: false,
        message: 'The auction closing deadline has already passed. No new bids can be accepted.',
      });
      return;
    }

    // 5. Minimum acceptable bid calculation
    let minAcceptableBid = 0;
    if (auction.bidCount === 0) {
      minAcceptableBid = auction.startingPrice;
    } else {
      minAcceptableBid = auction.currentLeadingBid + auction.minimumBidIncrement;
    }

    if (bidAmount < minAcceptableBid) {
      res.status(400).json({
        success: false,
        message: `Your bid of ₹${bidAmount} is too low. The minimum acceptable bid is ₹${minAcceptableBid}.`,
        minAcceptableBid,
      });
      return;
    }

    // 6. Concurrency Control: Atomic update
    // We check that auction is still active and currentLeadingBid matches what we validated
    const filter: any = {
      _id: auction._id,
      status: 'active',
      closingAt: { $gt: now },
    };

    if (auction.bidCount === 0) {
      filter.bidCount = 0;
    } else {
      filter.currentLeadingBid = auction.currentLeadingBid;
    }

    const updatedAuction = await Auction.findOneAndUpdate(
      filter,
      {
        $set: {
          currentLeadingBid: bidAmount,
          currentLeadingBidderId: bidderId,
        },
        $inc: { bidCount: 1 },
      },
      { new: true }
    );

    if (!updatedAuction) {
      // Competing bid arrived simultaneously! Fetch fresh leading bid
      const freshAuction = await Auction.findById(auctionId);
      const newMin = freshAuction
        ? freshAuction.currentLeadingBid + freshAuction.minimumBidIncrement
        : minAcceptableBid;

      res.status(409).json({
        success: false,
        message: `A competing bid was placed just now. The new minimum acceptable bid is ₹${newMin}.`,
        minAcceptableBid: newMin,
      });
      return;
    }

    // 7. Persist bid in history
    const bid = await Bid.create({
      auctionId: auction._id,
      bidderId,
      amount: bidAmount,
      createdAt: now,
    });

    const populatedBid = await Bid.findById(bid._id)
      .populate('bidderId', 'fullName department year')
      .lean();

    // 8. Broadcast real-time update
    broadcastAuctionUpdate(auction._id.toString(), 'new_bid', {
      auctionId: auction._id,
      bid: populatedBid,
      currentLeadingBid: bidAmount,
      bidCount: updatedAuction.bidCount,
      minAcceptableBid: bidAmount + updatedAuction.minimumBidIncrement,
    });

    res.status(201).json({
      success: true,
      message: `Your bid of ₹${bidAmount} was successfully placed! You are now the leading bidder.`,
      bid: populatedBid,
      auction: {
        _id: updatedAuction._id,
        currentLeadingBid: updatedAuction.currentLeadingBid,
        bidCount: updatedAuction.bidCount,
        minAcceptableBid: bidAmount + updatedAuction.minimumBidIncrement,
      },
    });
  } catch (error: any) {
    console.error('[Place Bid Error]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error processing bid.',
    });
  }
};

export const getAuctionBids = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params.id;
    const auctionId = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!auctionId || !mongoose.Types.ObjectId.isValid(auctionId)) {
      res.status(400).json({ success: false, message: 'Invalid auction ID format.' });
      return;
    }

    const bids = await Bid.find({ auctionId })
      .populate('bidderId', 'fullName department year createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: bids.length,
      bids,
    });
  } catch (error: any) {
    console.error('[Get Bids Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve bid history.',
    });
  }
};

export const getMyBids = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const bidderId = req.user._id;

    // Find all distinct auctions this student placed bids on
    const userBids = await Bid.find({ bidderId }).sort({ createdAt: -1 }).lean();

    // Group by auctionId and keep student's latest/highest bid
    const auctionMap = new Map<string, { myLatestBid: number; myHighestBid: number; placedAt: Date }>();

    for (const b of userBids) {
      const aId = b.auctionId.toString();
      if (!auctionMap.has(aId)) {
        auctionMap.set(aId, {
          myLatestBid: b.amount,
          myHighestBid: b.amount,
          placedAt: b.createdAt,
        });
      } else {
        const existing = auctionMap.get(aId)!;
        if (b.amount > existing.myHighestBid) {
          existing.myHighestBid = b.amount;
        }
      }
    }

    const auctionIds = Array.from(auctionMap.keys());
    const auctions = await Auction.find({ _id: { $in: auctionIds } })
      .populate('sellerId', 'fullName department year')
      .populate('currentLeadingBidderId', 'fullName')
      .lean();

    // Check transactions for ended/reserved auctions
    const transactions = await Transaction.find({
      auctionId: { $in: auctionIds },
      buyerId: bidderId,
    }).lean();

    const transactionMap = new Map<string, any>();
    for (const t of transactions) {
      transactionMap.set(t.auctionId.toString(), t);
    }

    const results = auctions.map((auc) => {
      const bidInfo = auctionMap.get(auc._id.toString())!;
      const isLeading =
        auc.currentLeadingBidderId &&
        ((auc.currentLeadingBidderId as any)._id?.toString() === bidderId.toString() ||
          auc.currentLeadingBidderId.toString() === bidderId.toString());

      const isWon = (auc.status === 'reserved' || auc.status === 'sold') && isLeading;
      const isLost = (auc.status === 'ended' || auc.status === 'sold' || auc.status === 'reserved') && !isLeading;
      const trans = transactionMap.get(auc._id.toString());

      return {
        auction: auc,
        myLatestBid: bidInfo.myLatestBid,
        myHighestBid: bidInfo.myHighestBid,
        isLeading,
        isWon,
        isLost,
        transaction: trans || null,
      };
    });

    res.status(200).json({
      success: true,
      count: results.length,
      myBids: results,
    });
  } catch (error: any) {
    console.error('[Get My Bids Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve your bidding activity.',
    });
  }
};
