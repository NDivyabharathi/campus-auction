import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Transaction, ITransaction } from '../models/Transaction.js';
import { Auction } from '../models/Auction.js';
import { Bid } from '../models/Bid.js';
import { AuthRequest } from '../middleware/auth.js';
import { broadcastAuctionUpdate } from '../socket.js';
import { ENV } from '../config/env.js';
import { processAuctionClosure } from '../services/auctionClosureService.js';
import { createNotification } from '../services/notificationService.js';

export const getMyTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const userId = req.user._id;

    const transactions = await Transaction.find({
      $or: [{ sellerId: userId }, { buyerId: userId }],
    })
      .populate('auctionId')
      .populate('sellerId', 'fullName department year')
      .populate('buyerId', 'fullName department year')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: transactions.length,
      transactions,
    });
  } catch (error: any) {
    console.error('[Get Transactions Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transactions.',
    });
  }
};

export const getTransactionById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid transaction ID format.' });
      return;
    }

    const transaction = await Transaction.findById(id)
      .populate('auctionId')
      .populate('sellerId', 'fullName department year')
      .populate('buyerId', 'fullName department year');

    if (!transaction) {
      res.status(404).json({ success: false, message: 'Transaction record not found.' });
      return;
    }

    // Access control: only seller or buyer
    const userId = req.user._id;
    const isSeller = transaction.sellerId._id.equals(userId);
    const isBuyer = transaction.buyerId._id.equals(userId);

    if (!isSeller && !isBuyer) {
      res.status(403).json({
        success: false,
        message: 'Access denied: You are not a party to this transaction.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      transaction,
      isSeller,
      isBuyer,
    });
  } catch (error: any) {
    console.error('[Get Transaction Details Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transaction details.',
    });
  }
};

export const updateHandoverDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const { handoverLocation, handoverDateTime, handoverNotes } = req.body;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid transaction ID format.' });
      return;
    }

    const transaction = await Transaction.findById(id);
    if (!transaction) {
      res.status(404).json({ success: false, message: 'Transaction record not found.' });
      return;
    }

    const userId = req.user._id;
    const isSeller = transaction.sellerId.equals(userId);
    const isBuyer = transaction.buyerId.equals(userId);

    if (!isSeller && !isBuyer) {
      res.status(403).json({
        success: false,
        message: 'Access denied: You must be the buyer or seller to schedule handover.',
      });
      return;
    }

    if (transaction.status === 'completed' || transaction.status === 'failed') {
      res.status(400).json({
        success: false,
        message: `Cannot update handover details because transaction is already ${transaction.status}.`,
      });
      return;
    }

    if (handoverLocation) transaction.handoverLocation = handoverLocation.trim();
    if (handoverDateTime) transaction.handoverDateTime = new Date(handoverDateTime);
    if (handoverNotes !== undefined) transaction.handoverNotes = handoverNotes.trim();

    transaction.status = 'handover_scheduled';
    await transaction.save();

    const populated = await Transaction.findById(id)
      .populate('auctionId')
      .populate('sellerId', 'fullName department year')
      .populate('buyerId', 'fullName department year');

    broadcastAuctionUpdate(transaction.auctionId.toString(), 'transaction_updated', populated);

    // Notify the other party about proposed/updated handover details
    const peerId = isSeller ? transaction.buyerId : transaction.sellerId;
    createNotification({
      recipientId: peerId.toString(),
      type: 'handover_scheduled',
      title: 'Handover Meeting Scheduled',
      message: `${req.user.fullName} proposed/updated meeting details for "${(populated?.auctionId as any)?.title || 'your item'}": ${transaction.handoverLocation}.`,
      auctionId: (populated?.auctionId as any)?._id || transaction.auctionId,
      transactionId: transaction._id,
      actorId: req.user._id,
    }).catch((err) => console.error('[Notification Error] Handover scheduled:', err));

    res.status(200).json({
      success: true,
      message: 'Campus handover meeting details successfully updated.',
      transaction: populated,
    });
  } catch (error: any) {
    console.error('[Update Handover Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update handover details.',
    });
  }
};

export const confirmHandover = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid transaction ID format.' });
      return;
    }

    const transaction = await Transaction.findById(id);
    if (!transaction) {
      res.status(404).json({ success: false, message: 'Transaction not found.' });
      return;
    }

    const auction = await Auction.findById(transaction.auctionId);

    const userId = req.user._id;
    const isSeller = transaction.sellerId.equals(userId);
    const isBuyer = transaction.buyerId.equals(userId);

    if (!isSeller && !isBuyer) {
      res.status(403).json({
        success: false,
        message: 'Access denied: Only the buyer or seller can confirm handover.',
      });
      return;
    }

    if (transaction.status === 'completed') {
      res.status(400).json({
        success: false,
        message: 'This campus handover transaction is already marked as completed.',
      });
      return;
    }

    const now = new Date();

    if (isSeller) {
      transaction.sellerConfirmedAt = now;
    }
    if (isBuyer) {
      transaction.buyerConfirmedAt = now;
    }

    // Two-party confirmation check: Both must confirm
    const isFullyConfirmed = !!(transaction.sellerConfirmedAt && transaction.buyerConfirmedAt);

    if (isFullyConfirmed) {
      transaction.status = 'completed';
      // Mark auction as sold
      await Auction.findByIdAndUpdate(transaction.auctionId, { status: 'sold' });
    }

    await transaction.save();

    const populated = await Transaction.findById(id)
      .populate('auctionId')
      .populate('sellerId', 'fullName department year')
      .populate('buyerId', 'fullName department year');

    broadcastAuctionUpdate(transaction.auctionId.toString(), 'transaction_updated', populated);

    const itemTitle = (populated?.auctionId as any)?.title || 'your item';
    const peerId = isSeller ? transaction.buyerId : transaction.sellerId;

    if (isFullyConfirmed) {
      // Notify both parties that handover is completed
      createNotification({
        recipientId: transaction.sellerId.toString(),
        type: 'transaction_completed',
        title: 'Handover Completed! 🎉',
        message: `Physical handover for "${itemTitle}" was verified by both parties. Transaction complete!`,
        auctionId: (populated?.auctionId as any)?._id || transaction.auctionId,
        transactionId: transaction._id,
        deduplicationKey: `tx_completed_seller_${transaction._id}`,
      }).catch((err) => console.error('[Notification Error] Transaction completed (seller):', err));

      createNotification({
        recipientId: transaction.buyerId.toString(),
        type: 'transaction_completed',
        title: 'Handover Completed! 🎉',
        message: `Physical handover for "${itemTitle}" was verified by both parties. Enjoy your item!`,
        auctionId: (populated?.auctionId as any)?._id || transaction.auctionId,
        transactionId: transaction._id,
        deduplicationKey: `tx_completed_buyer_${transaction._id}`,
      }).catch((err) => console.error('[Notification Error] Transaction completed (buyer):', err));
    } else {
      // Notify the other party that their peer has confirmed
      createNotification({
        recipientId: peerId.toString(),
        type: 'handover_confirmed_by_peer',
        title: 'Peer Confirmed Handover',
        message: `${req.user.fullName} confirmed physical handover for "${itemTitle}". Please confirm on your end to complete transaction.`,
        auctionId: (populated?.auctionId as any)?._id || transaction.auctionId,
        transactionId: transaction._id,
        actorId: req.user._id,
      }).catch((err) => console.error('[Notification Error] Handover confirmed by peer:', err));
    }

    res.status(200).json({
      success: true,
      message: isFullyConfirmed
        ? 'Physical handover verified by both parties! Transaction is officially completed.'
        : `Your handover confirmation was recorded. Waiting for ${
            isSeller ? 'the buyer' : 'the seller'
          } to confirm.`,
      transaction: populated,
      isFullyConfirmed,
    });
  } catch (error: any) {
    console.error('[Confirm Handover Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm handover.',
    });
  }
};

export const failAndReassign = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const { reason = 'Winning bidder failed to meet or collect item within deadline.' } = req.body;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid transaction ID format.' });
      return;
    }

    const transaction = await Transaction.findById(id);
    if (!transaction) {
      res.status(404).json({ success: false, message: 'Transaction not found.' });
      return;
    }

    const auction = await Auction.findById(transaction.auctionId);

    const userId = req.user._id;
    const isSeller = transaction.sellerId.equals(userId);

    // Only seller or system can trigger failure & reassignment
    if (!isSeller) {
      res.status(403).json({
        success: false,
        message: 'Only the seller can report failed pickup or request reassignment.',
      });
      return;
    }

    if (transaction.status === 'completed') {
      res.status(400).json({
        success: false,
        message: 'Cannot fail an already completed transaction.',
      });
      return;
    }

    // 1. Mark current transaction as failed
    transaction.status = 'failed';
    transaction.failureReason = reason;
    await transaction.save();

    // Notify the failed buyer
    createNotification({
      recipientId: transaction.buyerId.toString(),
      type: 'transaction_failed',
      title: 'Handover Marked Missed / Failed',
      message: `The campus handover for "${auction?.title || 'your item'}" was marked as failed: ${reason}.`,
      auctionId: transaction.auctionId,
      transactionId: transaction._id,
      actorId: req.user._id,
      deduplicationKey: `tx_failed_${transaction._id}`,
    }).catch((err) => console.error('[Notification Error] Transaction failed:', err));

    // 2. Find previous failed buyer IDs for this auction to prevent re-offering to same failed bidder
    const failedTransactions = await Transaction.find({
      auctionId: transaction.auctionId,
      status: 'failed',
    }).select('buyerId');

    const disqualifiedBuyerIds = failedTransactions.map((t) => t.buyerId.toString());

    // 3. Find next-highest eligible bidder
    const nextEligibleBid = await Bid.findOne({
      auctionId: transaction.auctionId,
      bidderId: { $nin: disqualifiedBuyerIds, $ne: transaction.sellerId },
    })
      .sort({ amount: -1, createdAt: 1 })
      .populate('bidderId', 'fullName department year');

    if (!nextEligibleBid || !auction) {
      // No more eligible bidders -> Mark auction unsold
      if (auction) {
        auction.status = 'unsold';
        await auction.save();

        createNotification({
          recipientId: auction.sellerId.toString(),
          type: 'auction_unsold',
          title: 'Item Unsold (No Further Bidders)',
          message: `No other eligible bidders remain for "${auction.title}". The auction has been marked unsold.`,
          auctionId: auction._id,
          deduplicationKey: `auction_unsold_after_fail_${transaction._id}`,
        }).catch((err) => console.error('[Notification Error] Unsold after fail:', err));
      }

      broadcastAuctionUpdate(transaction.auctionId.toString(), 'auction_ended', {
        status: 'unsold',
        message: 'No eligible bidders remain. Auction marked unsold.',
      });

      res.status(200).json({
        success: true,
        message: 'Transaction marked failed. No other eligible bidders found; auction is now unsold.',
        reassigned: false,
      });
      return;
    }

    // 4. Create new reservation for the next eligible bidder
    const reservationDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const newTransaction = await Transaction.create({
      auctionId: auction._id,
      sellerId: auction.sellerId,
      buyerId: nextEligibleBid.bidderId,
      amount: nextEligibleBid.amount,
      status: 'awaiting_handover',
      reservationDeadline,
      attemptNumber: transaction.attemptNumber + 1,
    });

    // Update auction leading fields to reflect current reserved winner
    auction.status = 'reserved';
    auction.currentLeadingBid = nextEligibleBid.amount;
    auction.currentLeadingBidderId = (nextEligibleBid.bidderId as any)._id || nextEligibleBid.bidderId;
    await auction.save();

    const populatedNew = await Transaction.findById(newTransaction._id)
      .populate('auctionId')
      .populate('sellerId', 'fullName department year')
      .populate('buyerId', 'fullName department year');

    broadcastAuctionUpdate(auction._id.toString(), 'transaction_reassigned', {
      auctionId: auction._id,
      newWinner: nextEligibleBid.bidderId,
      amount: nextEligibleBid.amount,
      transaction: populatedNew,
    });

    const newWinnerId = ((nextEligibleBid.bidderId as any)._id || nextEligibleBid.bidderId).toString();
    const newWinnerName = (nextEligibleBid.bidderId as any).fullName || 'Kongu student';

    // Notify new winning bidder
    createNotification({
      recipientId: newWinnerId,
      type: 'handover_reassigned',
      title: 'You are Next Eligible Bidder! 🎉',
      message: `The previous buyer missed pickup for "${auction.title}". The item is now offered and reserved for you at ₹${nextEligibleBid.amount}!`,
      auctionId: auction._id,
      transactionId: newTransaction._id,
      actorId: auction.sellerId,
      deduplicationKey: `tx_reassigned_buyer_${newTransaction._id}`,
    }).catch((err) => console.error('[Notification Error] Reassigned (buyer):', err));

    // Notify seller
    createNotification({
      recipientId: auction.sellerId.toString(),
      type: 'handover_reassigned',
      title: 'Item Reassigned to Next Bidder',
      message: `"${auction.title}" was offered to the next highest bidder (${newWinnerName}) for ₹${nextEligibleBid.amount}. Please coordinate handover.`,
      auctionId: auction._id,
      transactionId: newTransaction._id,
      deduplicationKey: `tx_reassigned_seller_${newTransaction._id}`,
    }).catch((err) => console.error('[Notification Error] Reassigned (seller):', err));

    res.status(200).json({
      success: true,
      message: `Item successfully reassigned to next eligible bidder: ${(nextEligibleBid.bidderId as any).fullName} for ₹${nextEligibleBid.amount}.`,
      reassigned: true,
      transaction: populatedNew,
    });
  } catch (error: any) {
    console.error('[Fail and Reassign Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reassign transaction.',
    });
  }
};

// DEV ONLY: Fast-forward auction for hackathon demonstration
export const devFastForwardAuction = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid auction ID format.' });
      return;
    }

    const auction = await Auction.findById(id);
    if (!auction) {
      res.status(404).json({ success: false, message: 'Auction not found.' });
      return;
    }

    // Set closingAt to 1 second ago and trigger closure
    auction.closingAt = new Date(Date.now() - 1000);
    await auction.save();

    const closed = await processAuctionClosure(auction._id.toString());

    res.status(200).json({
      success: true,
      message: `[Dev Demo] Auction "${auction.title}" fast-forwarded and closed!`,
      auction: closed,
    });
  } catch (error: any) {
    console.error('[Dev Fast Forward Error]', error);
    res.status(500).json({ success: false, message: 'Error in dev fast-forward.' });
  }
};
