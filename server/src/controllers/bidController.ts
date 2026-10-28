import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Auction } from '../models/Auction.js';
import { Bid } from '../models/Bid.js';
import { Transaction } from '../models/Transaction.js';
import { AuthRequest } from '../middleware/auth.js';
import { broadcastAuctionUpdate } from '../socket.js';
import { processAuctionClosure } from '../services/auctionClosureService.js';
import { createNotification } from '../services/notificationService.js';

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

    // 4. Server-authoritative closing time and anti-sniping extension rule
    let activeAuction = auction;
    const now = new Date();
    let currentClosingTime = new Date(activeAuction.closingAt);
    let remainingMs = currentClosingTime.getTime() - now.getTime();

    // If in-memory state indicates deadline has passed, re-check database
    // in case a concurrent bid just extended the auction
    if (remainingMs <= 0) {
      const freshCheck = await Auction.findById(auctionId);
      if (
        freshCheck &&
        freshCheck.status === 'active' &&
        new Date(freshCheck.closingAt).getTime() > now.getTime()
      ) {
        activeAuction = freshCheck;
        currentClosingTime = new Date(activeAuction.closingAt);
        remainingMs = currentClosingTime.getTime() - now.getTime();
      } else {
        // Legitimate expiration -> trigger automatic closure
        await processAuctionClosure(auction._id.toString());
        res.status(400).json({
          success: false,
          message: 'The auction closing deadline has already passed. No new bids can be accepted.',
        });
        return;
      }
    }

    // Anti-Sniping Rule:
    // If 0 < remainingMs <= 30,000 ms (30s or less remaining),
    // extend closing time to exactly 60 seconds after the accepted bid (now + 60,000 ms).
    const EXTENSION_THRESHOLD_MS = 30_000;
    const EXTENSION_DURATION_MS = 60_000;
    const shouldExtend = remainingMs > 0 && remainingMs <= EXTENSION_THRESHOLD_MS;
    const newClosingTime = shouldExtend ? new Date(now.getTime() + EXTENSION_DURATION_MS) : null;

    // 5. Minimum acceptable bid calculation
    let minAcceptableBid = 0;
    if (activeAuction.bidCount === 0) {
      minAcceptableBid = activeAuction.startingPrice;
    } else {
      minAcceptableBid = activeAuction.currentLeadingBid + activeAuction.minimumBidIncrement;
    }

    if (bidAmount < minAcceptableBid) {
      res.status(400).json({
        success: false,
        message: `Your bid of ₹${bidAmount} is too low. The minimum acceptable bid is ₹${minAcceptableBid}.`,
        minAcceptableBid,
      });
      return;
    }

    const previousLeadingBidderId = activeAuction.currentLeadingBidderId;

    // 6. Concurrency Control: Atomic update
    // We verify that the auction is still active and currentLeadingBid matches what we validated
    const filter: any = {
      _id: activeAuction._id,
      status: 'active',
      closingAt: { $gt: now },
    };

    if (activeAuction.bidCount === 0) {
      filter.bidCount = 0;
    } else {
      filter.currentLeadingBid = activeAuction.currentLeadingBid;
    }

    const updateOps: any = {
      $set: {
        currentLeadingBid: bidAmount,
        currentLeadingBidderId: bidderId,
      },
      $inc: { bidCount: 1 },
    };

    if (shouldExtend && newClosingTime) {
      updateOps.$set.closingAt = newClosingTime;
    }

    const updatedAuction = await Auction.findOneAndUpdate(
      filter,
      updateOps,
      { new: true }
    );

    if (!updatedAuction) {
      // Competing bid arrived simultaneously or auction closed! Fetch fresh state
      const freshAuction = await Auction.findById(auctionId);
      if (
        !freshAuction ||
        freshAuction.status !== 'active' ||
        new Date(freshAuction.closingAt).getTime() <= new Date().getTime()
      ) {
        res.status(400).json({
          success: false,
          message: 'The auction has ended or is no longer open for bidding.',
        });
        return;
      }

      const newMin =
        freshAuction.bidCount === 0
          ? freshAuction.startingPrice
          : freshAuction.currentLeadingBid + freshAuction.minimumBidIncrement;

      res.status(409).json({
        success: false,
        message: `A competing bid was placed just now. The new minimum acceptable bid is ₹${newMin}.`,
        minAcceptableBid: newMin,
      });
      return;
    }

    // 7. Persist bid in history
    const bid = await Bid.create({
      auctionId: activeAuction._id,
      bidderId,
      amount: bidAmount,
      createdAt: now,
    });

    const populatedBid = await Bid.findById(bid._id)
      .populate('bidderId', 'fullName department year')
      .lean();

    // 8. Broadcast real-time updates
    // 8a. If extended, broadcast dedicated 'auction:extended' and 'auction_extended' events
    if (shouldExtend && newClosingTime) {
      const extensionPayload = {
        auctionId: activeAuction._id.toString(),
        previousClosingTime: currentClosingTime.toISOString(),
        newClosingTime: updatedAuction.closingAt.toISOString(),
        extensionSeconds: 60,
        triggeredBy: 'accepted-bid',
      };
      broadcastAuctionUpdate(activeAuction._id.toString(), 'auction:extended', extensionPayload);
      broadcastAuctionUpdate(activeAuction._id.toString(), 'auction_extended', extensionPayload);
    }

    // 8b. Broadcast new_bid with updated closing time and extension indicator
    broadcastAuctionUpdate(activeAuction._id.toString(), 'new_bid', {
      auctionId: activeAuction._id,
      bid: populatedBid,
      currentLeadingBid: bidAmount,
      bidCount: updatedAuction.bidCount,
      minAcceptableBid: bidAmount + updatedAuction.minimumBidIncrement,
      closingAt: updatedAuction.closingAt.toISOString(),
      isExtended: shouldExtend,
      newClosingTime: shouldExtend ? updatedAuction.closingAt.toISOString() : undefined,
    });

    // 9. Dispatch in-app and push notifications asynchronously
    // 9a. Notify seller of incoming bid
    createNotification({
      recipientId: activeAuction.sellerId.toString(),
      type: 'bid_received',
      title: `New Bid on ${activeAuction.title}`,
      message: `${req.user.fullName} placed a bid of ₹${bidAmount} on "${activeAuction.title}".`,
      auctionId: activeAuction._id.toString(),
      actorId: bidderId.toString(),
    }).catch((err) => console.error('[Notification Error] Bid received alert:', err));

    // 9b. Notify previous leading bidder if outbid
    if (previousLeadingBidderId && !previousLeadingBidderId.equals(bidderId)) {
      createNotification({
        recipientId: previousLeadingBidderId.toString(),
        type: 'outbid',
        title: "You've been outbid!",
        message: `Someone placed a higher bid of ₹${bidAmount} on "${activeAuction.title}".`,
        auctionId: activeAuction._id.toString(),
        actorId: bidderId.toString(),
      }).catch((err) => console.error('[Notification Error] Outbid alert:', err));
    }

    res.status(201).json({
      success: true,
      message: shouldExtend
        ? `Your bid of ₹${bidAmount} was placed! Last-minute bid: auction extended by 60 seconds.`
        : `Your bid of ₹${bidAmount} was successfully placed! You are now the leading bidder.`,
      bid: populatedBid,
      auction: {
        _id: updatedAuction._id,
        currentLeadingBid: updatedAuction.currentLeadingBid,
        bidCount: updatedAuction.bidCount,
        minAcceptableBid: bidAmount + updatedAuction.minimumBidIncrement,
        closingAt: updatedAuction.closingAt,
        isExtended: shouldExtend,
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
