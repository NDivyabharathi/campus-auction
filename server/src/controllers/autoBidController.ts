import { Response } from 'express';
import mongoose from 'mongoose';
import { Auction } from '../models/Auction.js';
import { AutoBid } from '../models/AutoBid.js';
import { AuthRequest } from '../middleware/auth.js';
import { evaluateProxyBids } from '../services/proxyBidService.js';
import { createNotification } from '../services/notificationService.js';

export const enableAutoBid = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rawId = req.params.auctionId || req.params.id;
    const auctionId = Array.isArray(rawId) ? rawId[0] : rawId;
    const { maxAmount } = req.body;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    if (!auctionId || !mongoose.Types.ObjectId.isValid(auctionId)) {
      res.status(400).json({ success: false, message: 'Invalid auction ID format.' });
      return;
    }

    const parsedMax = Number(maxAmount);
    if (isNaN(parsedMax) || parsedMax <= 0 || !Number.isInteger(parsedMax)) {
      res.status(400).json({
        success: false,
        message: 'Maximum bid must be a valid positive whole rupee amount.',
      });
      return;
    }

    const auction = await Auction.findById(auctionId);
    if (!auction) {
      res.status(404).json({ success: false, message: 'Auction listing not found.' });
      return;
    }

    if (auction.sellerId.equals(req.user._id)) {
      res.status(403).json({
        success: false,
        message: 'Fairness Violation: You cannot enable automatic bidding on your own listing.',
      });
      return;
    }

    if (
      auction.status === 'scheduled' ||
      (auction.startTime && new Date(auction.startTime).getTime() > Date.now())
    ) {
      res.status(400).json({
        success: false,
        message: 'Automatic bidding cannot be configured before the auction opens.',
      });
      return;
    }

    if (auction.status !== 'active') {
      res.status(400).json({
        success: false,
        message: `Auction is ${auction.status}. Automatic bidding cannot be configured.`,
      });
      return;
    }

    if (new Date(auction.closingAt).getTime() <= Date.now()) {
      res.status(400).json({
        success: false,
        message: 'The auction closing deadline has already passed.',
      });
      return;
    }

    // Minimum required maximum validation
    let minRequired = 0;
    const isLeading = auction.currentLeadingBidderId && auction.currentLeadingBidderId.equals(req.user._id);

    if (auction.bidCount === 0) {
      minRequired = auction.startingPrice;
    } else if (isLeading) {
      minRequired = auction.currentLeadingBid;
    } else {
      minRequired = auction.currentLeadingBid + auction.minimumBidIncrement;
    }

    if (parsedMax < minRequired) {
      res.status(400).json({
        success: false,
        message: `Your maximum of ₹${parsedMax} is too low. It must be at least ₹${minRequired}.`,
        minRequired,
      });
      return;
    }

    // Upsert AutoBid configuration
    const autoBid = await AutoBid.findOneAndUpdate(
      { auctionId: auction._id, userId: req.user._id },
      {
        $set: {
          maxAmount: parsedMax,
          status: 'active',
          maxRegisteredAt: new Date(),
        },
      },
      { new: true, upsert: true }
    );

    // Private notification
    createNotification({
      recipientId: req.user._id.toString(),
      type: 'auto_bid_enabled',
      title: 'Automatic Bidding Enabled',
      message: `Automatic bidding is active up to ₹${parsedMax} for "${auction.title}".`,
      auctionId: auction._id.toString(),
      deduplicationKey: `auto_enabled_${auction._id}_${req.user._id}_${parsedMax}`,
    }).catch((err) => console.error('[Notification Error] Auto bid enabled alert:', err));

    // Evaluate proxy bidding immediately
    evaluateProxyBids(auction._id.toString()).catch((err) =>
      console.error('[Proxy Evaluation Error on Enable]', err)
    );

    res.status(200).json({
      success: true,
      message: `Automatic bidding enabled up to ₹${parsedMax}.`,
      autoBid: {
        _id: autoBid._id,
        auctionId: autoBid.auctionId,
        maxAmount: autoBid.maxAmount,
        status: autoBid.status,
        maxRegisteredAt: autoBid.maxRegisteredAt,
      },
    });
  } catch (error: any) {
    console.error('[Enable AutoBid Error]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error enabling automatic bidding.',
    });
  }
};

export const updateAutoBid = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rawId = req.params.auctionId || req.params.id;
    const auctionId = Array.isArray(rawId) ? rawId[0] : rawId;
    const { maxAmount, status } = req.body;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    if (!auctionId || !mongoose.Types.ObjectId.isValid(auctionId)) {
      res.status(400).json({ success: false, message: 'Invalid auction ID format.' });
      return;
    }

    const auction = await Auction.findById(auctionId);
    if (!auction) {
      res.status(404).json({ success: false, message: 'Auction listing not found.' });
      return;
    }

    if (
      auction.status === 'scheduled' ||
      (auction.startTime && new Date(auction.startTime).getTime() > Date.now())
    ) {
      res.status(400).json({
        success: false,
        message: 'Automatic bidding cannot be updated before the auction opens.',
      });
      return;
    }

    if (auction.status !== 'active' || new Date(auction.closingAt).getTime() <= Date.now()) {
      res.status(400).json({
        success: false,
        message: 'Auction is no longer open for bidding.',
      });
      return;
    }

    const existingConfig = await AutoBid.findOne({
      auctionId: auction._id,
      userId: req.user._id,
    });

    if (!existingConfig) {
      res.status(404).json({
        success: false,
        message: 'No automatic bidding configuration found to update.',
      });
      return;
    }

    const updateOps: any = {};

    if (status && ['active', 'paused', 'disabled'].includes(status)) {
      updateOps.status = status;
    }

    if (maxAmount !== undefined && maxAmount !== null) {
      const parsedMax = Number(maxAmount);
      if (isNaN(parsedMax) || parsedMax <= 0 || !Number.isInteger(parsedMax)) {
        res.status(400).json({
          success: false,
          message: 'Maximum bid must be a valid positive whole rupee amount.',
        });
        return;
      }

      updateOps.maxAmount = parsedMax;
      updateOps.maxRegisteredAt = new Date();
    }

    const updated = await AutoBid.findOneAndUpdate(
      { _id: existingConfig._id, userId: req.user._id },
      { $set: updateOps },
      { new: true }
    );

    // Private notification
    if (updateOps.status === 'paused') {
      createNotification({
        recipientId: req.user._id.toString(),
        type: 'auto_bid_paused',
        title: 'Automatic Bidding Paused',
        message: `Automatic bidding for "${auction.title}" has been paused.`,
        auctionId: auction._id.toString(),
      }).catch((err) => console.error('[Notification Error] Auto bid paused alert:', err));
    } else if (updateOps.maxAmount) {
      createNotification({
        recipientId: req.user._id.toString(),
        type: 'auto_bid_updated',
        title: 'Maximum Auto-Bid Updated',
        message: `Your maximum bid for "${auction.title}" is now ₹${updateOps.maxAmount}.`,
        auctionId: auction._id.toString(),
      }).catch((err) => console.error('[Notification Error] Auto bid updated alert:', err));
    }

    // Trigger re-evaluation if active
    if (updated && updated.status === 'active') {
      evaluateProxyBids(auction._id.toString()).catch((err) =>
        console.error('[Proxy Evaluation Error on Update]', err)
      );
    }

    res.status(200).json({
      success: true,
      message: 'Automatic bidding configuration updated successfully.',
      autoBid: {
        _id: updated!._id,
        auctionId: updated!.auctionId,
        maxAmount: updated!.maxAmount,
        status: updated!.status,
        maxRegisteredAt: updated!.maxRegisteredAt,
      },
    });
  } catch (error: any) {
    console.error('[Update AutoBid Error]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error updating automatic bidding.',
    });
  }
};

export const getMyAutoBid = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rawId = req.params.auctionId || req.params.id;
    const auctionId = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    if (!auctionId || !mongoose.Types.ObjectId.isValid(auctionId)) {
      res.status(400).json({ success: false, message: 'Invalid auction ID format.' });
      return;
    }

    const [auction, autoBid] = await Promise.all([
      Auction.findById(auctionId).select('sellerId currentLeadingBid currentLeadingBidderId minimumBidIncrement startingPrice bidCount status closingAt'),
      AutoBid.findOne({ auctionId, userId: req.user._id }),
    ]);

    if (!auction) {
      res.status(404).json({ success: false, message: 'Auction listing not found.' });
      return;
    }

    const isLeading =
      auction.currentLeadingBidderId && auction.currentLeadingBidderId.equals(req.user._id);

    res.status(200).json({
      success: true,
      autoBid: autoBid
        ? {
            _id: autoBid._id,
            auctionId: autoBid.auctionId,
            maxAmount: autoBid.maxAmount,
            status: autoBid.status,
            maxRegisteredAt: autoBid.maxRegisteredAt,
            lastAutoBidAt: autoBid.lastAutoBidAt,
          }
        : null,
      isLeading: Boolean(isLeading),
      currentLeadingBid: auction.currentLeadingBid,
    });
  } catch (error: any) {
    console.error('[Get AutoBid Error]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching automatic bidding configuration.',
    });
  }
};

export const disableAutoBid = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rawId = req.params.auctionId || req.params.id;
    const auctionId = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    if (!auctionId || !mongoose.Types.ObjectId.isValid(auctionId)) {
      res.status(400).json({ success: false, message: 'Invalid auction ID format.' });
      return;
    }

    const autoBid = await AutoBid.findOneAndUpdate(
      { auctionId, userId: req.user._id },
      { $set: { status: 'disabled' } },
      { new: true }
    );

    if (!autoBid) {
      res.status(404).json({
        success: false,
        message: 'No automatic bidding configuration found to disable.',
      });
      return;
    }

    createNotification({
      recipientId: req.user._id.toString(),
      type: 'auto_bid_disabled',
      title: 'Automatic Bidding Disabled',
      message: 'Automatic bidding has been disabled. Existing bids remain valid in bid history.',
      auctionId: auctionId.toString(),
    }).catch((err) => console.error('[Notification Error] Auto bid disabled alert:', err));

    res.status(200).json({
      success: true,
      message: 'Automatic bidding has been disabled.',
      autoBid: {
        _id: autoBid._id,
        auctionId: autoBid.auctionId,
        status: autoBid.status,
      },
    });
  } catch (error: any) {
    console.error('[Disable AutoBid Error]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error disabling automatic bidding.',
    });
  }
};
