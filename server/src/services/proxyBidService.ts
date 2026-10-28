import mongoose from 'mongoose';
import { Auction, IAuction } from '../models/Auction.js';
import { Bid, IBid } from '../models/Bid.js';
import { AutoBid, IAutoBid, AutoBidStatus } from '../models/AutoBid.js';
import { broadcastAuctionUpdate } from '../socket.js';
import { createNotification } from './notificationService.js';

// In-memory per-auction async lock queue to serialize proxy evaluations
const auctionQueues = new Map<string, Promise<any>>();

export function queueAuctionTask<T>(auctionId: string, task: () => Promise<T>): Promise<T> {
  const previous = auctionQueues.get(auctionId) || Promise.resolve();
  const next = previous
    .then(task)
    .catch((err) => {
      console.error(`[Proxy Lock Error on auction ${auctionId}]`, err);
      throw err;
    })
    .finally(() => {
      if (auctionQueues.get(auctionId) === next) {
        auctionQueues.delete(auctionId);
      }
    });

  auctionQueues.set(auctionId, next);
  return next;
}

interface InternalBidResult {
  success: boolean;
  bid?: any;
  auction?: any;
  isExtended?: boolean;
  error?: string;
}

/**
 * Atomically places a single bid on an auction.
 * Used for both manual and automatic proxy bids with shared anti-sniping and concurrency guarantees.
 */
export async function executeBidAtomically(params: {
  auctionId: string;
  bidderId: mongoose.Types.ObjectId;
  amount: number;
  bidSource: 'MANUAL' | 'AUTO';
  bidderName?: string;
}): Promise<InternalBidResult> {
  const { auctionId, bidderId, amount, bidSource, bidderName } = params;

  // 1. Fetch fresh auction state
  const auction = await Auction.findById(auctionId);
  if (!auction) {
    return { success: false, error: 'Auction listing not found.' };
  }

  const now = new Date();

  if (
    auction.status === 'scheduled' ||
    (auction.startTime && new Date(auction.startTime).getTime() > now.getTime())
  ) {
    return { success: false, error: 'Bidding has not opened yet for this scheduled auction.' };
  }

  if (auction.status !== 'active') {
    return { success: false, error: `Auction is ${auction.status}. Bidding is closed.` };
  }

  if (auction.sellerId.equals(bidderId)) {
    return { success: false, error: 'You cannot place a bid on your own auction listing.' };
  }

  let currentClosingTime = new Date(auction.closingAt);
  let remainingMs = currentClosingTime.getTime() - now.getTime();

  if (remainingMs <= 0) {
    return { success: false, error: 'The auction closing deadline has already passed.' };
  }

  // Anti-Sniping calculation: <= 30 seconds remaining extends by 60 seconds
  const EXTENSION_THRESHOLD_MS = 30_000;
  const EXTENSION_DURATION_MS = 60_000;
  const shouldExtend = remainingMs > 0 && remainingMs <= EXTENSION_THRESHOLD_MS;
  const newClosingTime = shouldExtend ? new Date(now.getTime() + EXTENSION_DURATION_MS) : null;

  // Validate bid amount
  let minAcceptableBid = 0;
  if (auction.bidCount === 0) {
    minAcceptableBid = auction.startingPrice;
  } else {
    minAcceptableBid = auction.currentLeadingBid + auction.minimumBidIncrement;
  }

  if (amount < minAcceptableBid) {
    return {
      success: false,
      error: `Bid amount ₹${amount} is lower than minimum acceptable bid ₹${minAcceptableBid}.`,
    };
  }

  const previousLeadingBidderId = auction.currentLeadingBidderId;

  // Atomic conditional update
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

  const updateOps: any = {
    $set: {
      currentLeadingBid: amount,
      currentLeadingBidderId: bidderId,
    },
    $inc: { bidCount: 1 },
  };

  if (shouldExtend && newClosingTime) {
    updateOps.$set.closingAt = newClosingTime;
  }

  const updatedAuction = await Auction.findOneAndUpdate(filter, updateOps, { new: true });
  if (!updatedAuction) {
    return { success: false, error: 'Concurrency conflict: Competing bid placed simultaneously.' };
  }

  // Create persistent bid record with bidSource
  const bid = await Bid.create({
    auctionId: auction._id,
    bidderId,
    amount,
    bidSource,
    createdAt: now,
  });

  const populatedBid = await Bid.findById(bid._id)
    .populate('bidderId', 'fullName department year')
    .lean();

  // If extended, broadcast dedicated 'auction:extended' and 'auction_extended'
  if (shouldExtend && newClosingTime) {
    const extensionPayload = {
      auctionId: auction._id.toString(),
      previousClosingTime: currentClosingTime.toISOString(),
      newClosingTime: updatedAuction.closingAt.toISOString(),
      extensionSeconds: 60,
      triggeredBy: bidSource === 'AUTO' ? 'auto-bid' : 'accepted-bid',
    };
    broadcastAuctionUpdate(auction._id.toString(), 'auction:extended', extensionPayload);
    broadcastAuctionUpdate(auction._id.toString(), 'auction_extended', extensionPayload);
  }

  // Broadcast new_bid publicly (Strictly does NOT include confidential proxy maxAmount)
  broadcastAuctionUpdate(auction._id.toString(), 'new_bid', {
    auctionId: auction._id,
    bid: populatedBid,
    currentLeadingBid: amount,
    bidCount: updatedAuction.bidCount,
    minAcceptableBid: amount + updatedAuction.minimumBidIncrement,
    closingAt: updatedAuction.closingAt.toISOString(),
    isExtended: shouldExtend,
    newClosingTime: shouldExtend ? updatedAuction.closingAt.toISOString() : undefined,
  });

  // Notifications
  // Notify seller of incoming bid
  createNotification({
    recipientId: auction.sellerId.toString(),
    type: 'bid_received',
    title: `New ${bidSource === 'AUTO' ? 'Automatic ' : ''}Bid on ${auction.title}`,
    message: `${bidderName || 'A student'} placed a bid of ₹${amount} on "${auction.title}".`,
    auctionId: auction._id.toString(),
    actorId: bidderId.toString(),
  }).catch((err) => console.error('[Notification Error] Bid received alert:', err));

  // Notify previous leading bidder if outbid
  if (previousLeadingBidderId && !previousLeadingBidderId.equals(bidderId)) {
    createNotification({
      recipientId: previousLeadingBidderId.toString(),
      type: 'outbid',
      title: "You've been outbid!",
      message: `Someone placed a higher bid of ₹${amount} on "${auction.title}".`,
      auctionId: auction._id.toString(),
      actorId: bidderId.toString(),
    }).catch((err) => console.error('[Notification Error] Outbid alert:', err));
  }

  // If placed via auto-bid, notify the bidder privately
  if (bidSource === 'AUTO') {
    createNotification({
      recipientId: bidderId.toString(),
      type: 'auto_bid_placed',
      title: 'Automatic Bid Placed',
      message: `An automatic bid of ₹${amount} was placed on your behalf for "${auction.title}".`,
      auctionId: auction._id.toString(),
      deduplicationKey: `auto_bid_${auction._id}_${amount}`,
    }).catch((err) => console.error('[Notification Error] Auto bid placed alert:', err));
  }

  return {
    success: true,
    bid: populatedBid,
    auction: updatedAuction,
    isExtended: shouldExtend,
  };
}

/**
 * Evaluates active proxy auto-bids for an auction and places required bids deterministically.
 * Wrapped in per-auction queue to prevent race conditions.
 */
export async function evaluateProxyBids(auctionId: string): Promise<{
  resolved: boolean;
  bidsPlaced: number;
}> {
  return queueAuctionTask(auctionId, async () => {
    let bidsPlaced = 0;
    const MAX_ROUNDS = 20;
    let round = 0;

    while (round < MAX_ROUNDS) {
      round++;

      // 1. Fetch fresh auction state
      const auction = await Auction.findById(auctionId);
      if (
        !auction ||
        auction.status !== 'active' ||
        (auction.startTime && new Date(auction.startTime) > new Date()) ||
        new Date(auction.closingAt) <= new Date()
      ) {
        break;
      }

      // 2. Fetch all active AutoBids for this auction, excluding seller
      const activeConfigs = await AutoBid.find({
        auctionId: auction._id,
        status: 'active',
        userId: { $ne: auction.sellerId },
      }).sort({ maxAmount: -1, maxRegisteredAt: 1 });

      if (activeConfigs.length === 0) {
        break;
      }

      const currentLeaderId = auction.currentLeadingBidderId
        ? auction.currentLeadingBidderId.toString()
        : null;

      const currentPrice = auction.currentLeadingBid || 0;
      const minIncrement = auction.minimumBidIncrement || 10;
      const nextMinBid = auction.bidCount === 0 ? auction.startingPrice : currentPrice + minIncrement;

      // Filter challengers (active auto-bidders who are NOT currently leading)
      const challengers = activeConfigs.filter(
        (cfg) => cfg.userId.toString() !== currentLeaderId
      );

      if (challengers.length === 0) {
        // Current leader is already an auto-bidder, holding the lead. No challenger can outbid!
        break;
      }

      // Top challenger
      const topChallenger = challengers[0];

      // If top challenger cannot afford the next minimum bid, notify them and stop
      if (topChallenger.maxAmount < nextMinBid) {
        createNotification({
          recipientId: topChallenger.userId.toString(),
          type: 'auto_bid_max_exceeded',
          title: 'Maximum Auto-Bid Exceeded',
          message: `Your maximum of ₹${topChallenger.maxAmount} for "${auction.title}" has been outbid. Increase your maximum to regain the lead.`,
          auctionId: auction._id.toString(),
          deduplicationKey: `auto_max_exceeded_${auction._id}_${topChallenger.userId}_${topChallenger.maxAmount}`,
        }).catch((err) => console.error('[Notification Error] Max exceeded alert:', err));

        // Since activeConfigs is sorted by maxAmount DESC, no other challenger can afford it either
        break;
      }

      // Check if current leader is ALSO an active AutoBid
      const leaderConfig = activeConfigs.find(
        (cfg) => cfg.userId.toString() === currentLeaderId
      );

      if (leaderConfig) {
        // Competing Proxy Bidders: leaderConfig vs topChallenger
        const leaderMax = leaderConfig.maxAmount;
        const challengerMax = topChallenger.maxAmount;

        if (challengerMax > leaderMax) {
          // Challenger has a strictly higher maximum.
          // 1. Leader can bid up to leaderMax if leader is not already at leaderMax
          if (auction.currentLeadingBid < leaderMax) {
            const pushLeaderResult = await executeBidAtomically({
              auctionId: auction._id.toString(),
              bidderId: leaderConfig.userId,
              amount: leaderMax,
              bidSource: 'AUTO',
            });
            if (pushLeaderResult.success) {
              bidsPlaced++;
              await AutoBid.updateOne(
                { _id: leaderConfig._id },
                { $set: { lastAutoBidAt: new Date() } }
              );
            }
          }

          // 2. Challenger then places leaderMax + minIncrement (capped at challengerMax)
          const challengerBid = Math.min(challengerMax, leaderMax + minIncrement);
          const challengerResult = await executeBidAtomically({
            auctionId: auction._id.toString(),
            bidderId: topChallenger.userId,
            amount: challengerBid,
            bidSource: 'AUTO',
          });

          if (challengerResult.success) {
            bidsPlaced++;
            await AutoBid.updateOne(
              { _id: topChallenger._id },
              { $set: { lastAutoBidAt: new Date() } }
            );

            // Leader max is now exceeded
            createNotification({
              recipientId: leaderConfig.userId.toString(),
              type: 'auto_bid_max_exceeded',
              title: 'Maximum Auto-Bid Exceeded',
              message: `Your maximum of ₹${leaderConfig.maxAmount} for "${auction.title}" was outbid. Increase your maximum to regain the lead.`,
              auctionId: auction._id.toString(),
              deduplicationKey: `auto_max_exceeded_${auction._id}_${leaderConfig.userId}_${leaderConfig.maxAmount}`,
            }).catch((err) => console.error('[Notification Error] Leader max exceeded alert:', err));
          }
        } else if (challengerMax < leaderMax) {
          // Leader has higher maximum.
          // 1. Challenger bids their maximum
          if (auction.currentLeadingBid < challengerMax) {
            const pushChallengerResult = await executeBidAtomically({
              auctionId: auction._id.toString(),
              bidderId: topChallenger.userId,
              amount: challengerMax,
              bidSource: 'AUTO',
            });
            if (pushChallengerResult.success) {
              bidsPlaced++;
              await AutoBid.updateOne(
                { _id: topChallenger._id },
                { $set: { lastAutoBidAt: new Date() } }
              );
            }
          }

          // 2. Leader counters at challengerMax + minIncrement (capped at leaderMax)
          const leaderCounter = Math.min(leaderMax, challengerMax + minIncrement);
          const counterResult = await executeBidAtomically({
            auctionId: auction._id.toString(),
            bidderId: leaderConfig.userId,
            amount: leaderCounter,
            bidSource: 'AUTO',
          });

          if (counterResult.success) {
            bidsPlaced++;
            await AutoBid.updateOne(
              { _id: leaderConfig._id },
              { $set: { lastAutoBidAt: new Date() } }
            );

            // Challenger is outbid
            createNotification({
              recipientId: topChallenger.userId.toString(),
              type: 'auto_bid_max_exceeded',
              title: 'Maximum Auto-Bid Exceeded',
              message: `Your maximum of ₹${topChallenger.maxAmount} for "${auction.title}" was outbid.`,
              auctionId: auction._id.toString(),
              deduplicationKey: `auto_max_exceeded_${auction._id}_${topChallenger.userId}_${topChallenger.maxAmount}`,
            }).catch((err) => console.error('[Notification Error] Challenger max exceeded alert:', err));
          }
        } else {
          // Tie in maximums (challengerMax === leaderMax)
          // Tie-breaking rule: The one who registered earlier wins the tie!
          const leaderRegisteredFirst =
            new Date(leaderConfig.maxRegisteredAt).getTime() <=
            new Date(topChallenger.maxRegisteredAt).getTime();

          if (leaderRegisteredFirst) {
            // Leader registered earlier and holds priority on this maximum.
            // Push leader's bid to leaderMax (if not already at leaderMax)
            if (auction.currentLeadingBid < leaderMax) {
              const tieResult = await executeBidAtomically({
                auctionId: auction._id.toString(),
                bidderId: leaderConfig.userId,
                amount: leaderMax,
                bidSource: 'AUTO',
              });
              if (tieResult.success) {
                bidsPlaced++;
                await AutoBid.updateOne(
                  { _id: leaderConfig._id },
                  { $set: { lastAutoBidAt: new Date() } }
                );
              }
            }

            // Challenger is notified that their maximum was matched by an earlier registrant
            createNotification({
              recipientId: topChallenger.userId.toString(),
              type: 'auto_bid_max_exceeded',
              title: 'Maximum Auto-Bid Exceeded',
              message: `Your maximum of ₹${topChallenger.maxAmount} for "${auction.title}" was matched by an earlier bidder with priority.`,
              auctionId: auction._id.toString(),
              deduplicationKey: `auto_max_exceeded_${auction._id}_${topChallenger.userId}_${topChallenger.maxAmount}`,
            }).catch((err) => console.error('[Notification Error] Challenger tie alert:', err));
          } else {
            // Challenger registered earlier: challenger takes tie at challengerMax
            const tieResult = await executeBidAtomically({
              auctionId: auction._id.toString(),
              bidderId: topChallenger.userId,
              amount: challengerMax,
              bidSource: 'AUTO',
            });
            if (tieResult.success) {
              bidsPlaced++;
              await AutoBid.updateOne(
                { _id: topChallenger._id },
                { $set: { lastAutoBidAt: new Date() } }
              );
            }

            // Leader is notified that their maximum was matched by an earlier registrant
            createNotification({
              recipientId: leaderConfig.userId.toString(),
              type: 'auto_bid_max_exceeded',
              title: 'Maximum Auto-Bid Exceeded',
              message: `Your maximum of ₹${leaderConfig.maxAmount} for "${auction.title}" was matched by an earlier bidder with priority.`,
              auctionId: auction._id.toString(),
              deduplicationKey: `auto_max_exceeded_${auction._id}_${leaderConfig.userId}_${leaderConfig.maxAmount}`,
            }).catch((err) => console.error('[Notification Error] Leader tie alert:', err));
          }
        }
      } else {
        // Current leader is a manual bidder (or 0 bids placed yet)
        const bidResult = await executeBidAtomically({
          auctionId: auction._id.toString(),
          bidderId: topChallenger.userId,
          amount: nextMinBid,
          bidSource: 'AUTO',
        });

        if (bidResult.success) {
          bidsPlaced++;
          await AutoBid.updateOne(
            { _id: topChallenger._id },
            { $set: { lastAutoBidAt: new Date() } }
          );
        } else {
          // Could not place bid, break
          break;
        }
      }
    }

    return { resolved: true, bidsPlaced };
  });
}
