import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Auction, IAuction } from '../models/Auction.js';
import { AuthRequest } from '../middleware/auth.js';
import { broadcastAuctionUpdate } from '../socket.js';
import { processAuctionClosure, activateScheduledAuction } from '../services/auctionClosureService.js';
import { checkNewListingMatches } from '../services/wantService.js';

export const getAuctions = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      category,
      condition,
      minPrice,
      maxPrice,
      status = 'active',
      sort = 'ending_soon',
    } = req.query;

    const query: any = {};

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Category filter
    if (category && category !== 'All') {
      query.category = category;
    }

    // Condition filter
    if (condition && condition !== 'All') {
      query.condition = condition;
    }

    // Keyword search in title and description
    if (search && typeof search === 'string' && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ title: regex }, { description: regex }];
    }

    // Price range filter
    if (minPrice || maxPrice) {
      const priceConditions: any = {};
      if (minPrice) {
        priceConditions.$gte = Number(minPrice);
      }
      if (maxPrice) {
        priceConditions.$lte = Number(maxPrice);
      }

      // Check current leading bid if placed, otherwise startingPrice
      query.$or = [
        { currentLeadingBid: { $gt: 0, ...priceConditions } },
        { currentLeadingBid: 0, startingPrice: priceConditions },
      ];
    }

    // Determine sort order
    let sortOption: any = { closingAt: 1 }; // default: ending soon
    if (sort === 'recently_listed') {
      sortOption = { createdAt: -1 };
    } else if (sort === 'price_low') {
      sortOption = { currentLeadingBid: 1, startingPrice: 1 };
    } else if (sort === 'price_high') {
      sortOption = { currentLeadingBid: -1, startingPrice: -1 };
    } else if (sort === 'ending_soon') {
      sortOption = { closingAt: 1 };
    }

    const auctions = await Auction.find(query)
      .populate('sellerId', 'fullName department year createdAt')
      .populate('currentLeadingBidderId', 'fullName')
      .sort(sortOption)
      .lean();

    // Check on-the-fly for any scheduled auctions ready to open or expired active auctions
    const now = new Date();
    const updatedAuctions = await Promise.all(
      auctions.map(async (auc) => {
        if (auc.status === 'scheduled' && new Date(auc.startTime).getTime() <= now.getTime()) {
          const activated = await activateScheduledAuction(auc._id.toString());
          return activated || auc;
        }
        if (auc.status === 'active' && new Date(auc.closingAt).getTime() <= now.getTime()) {
          const closed = await processAuctionClosure(auc._id.toString());
          return closed || auc;
        }
        return auc;
      })
    );

    res.status(200).json({
      success: true,
      count: updatedAuctions.length,
      auctions: updatedAuctions,
    });
  } catch (error: any) {
    console.error('[Get Auctions Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch auction listings.',
    });
  }
};

export const getAuctionById = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid auction ID format.',
      });
      return;
    }

    let auction = await Auction.findById(id)
      .populate('sellerId', 'fullName department year createdAt')
      .populate('currentLeadingBidderId', 'fullName');

    if (!auction) {
      res.status(404).json({
        success: false,
        message: 'Auction listing not found.',
      });
      return;
    }

    // If scheduled and opening time reached, activate immediately on-the-fly
    if (auction.status === 'scheduled' && new Date(auction.startTime).getTime() <= new Date().getTime()) {
      const activated = await activateScheduledAuction(auction._id.toString());
      if (activated) {
        auction = await Auction.findById(id)
          .populate('sellerId', 'fullName department year createdAt')
          .populate('currentLeadingBidderId', 'fullName');
      }
    }

    // If active and past deadline, close immediately
    if (auction && auction.status === 'active' && new Date(auction.closingAt).getTime() <= new Date().getTime()) {
      const closed = await processAuctionClosure(auction._id.toString());
      if (closed) {
        auction = await Auction.findById(id)
          .populate('sellerId', 'fullName department year createdAt')
          .populate('currentLeadingBidderId', 'fullName');
      }
    }

    if (!auction) {
      res.status(404).json({ success: false, message: 'Auction not found.' });
      return;
    }

    const minAcceptableBid =
      auction.bidCount > 0
        ? auction.currentLeadingBid + auction.minimumBidIncrement
        : auction.startingPrice;

    res.status(200).json({
      success: true,
      auction,
      minAcceptableBid,
    });
  } catch (error: any) {
    console.error('[Get Auction Details Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve auction details.',
    });
  }
};

export const createAuction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      title,
      description,
      category,
      condition,
      startingPrice,
      minimumBidIncrement,
      duration,
      startTime,
      closingAt,
      imageUrls,
    } = req.body;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    // Validation
    if (!title || !description || !category || !condition || !startingPrice) {
      res.status(400).json({
        success: false,
        message: 'All required listing fields must be filled.',
      });
      return;
    }

    if (!duration && !closingAt) {
      res.status(400).json({
        success: false,
        message: 'All required listing fields must be filled.',
      });
      return;
    }

    const priceNum = Number(startingPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      res.status(400).json({
        success: false,
        message: 'Starting price must be a positive amount greater than zero.',
      });
      return;
    }

    const incrementNum = Number(minimumBidIncrement) || 10;
    if (incrementNum <= 0) {
      res.status(400).json({
        success: false,
        message: 'Minimum bid increment must be greater than zero.',
      });
      return;
    }

    const now = new Date();
    let startDate = new Date();
    let closingDate: Date;

    // Parse and determine startDate and closingDate based on duration / explicit times
    if (duration === 'custom') {
      if (!startTime || !closingAt) {
        res.status(400).json({
          success: false,
          message: 'Custom schedule requires both opening and closing dates and times.',
        });
        return;
      }

      const parsedStart = new Date(startTime);
      if (isNaN(parsedStart.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Auction opening date and time must be a valid timestamp.',
        });
        return;
      }

      if (parsedStart.getTime() < now.getTime() - 60_000) {
        res.status(400).json({
          success: false,
          message: 'Auction opening date and time cannot be set in the past.',
        });
        return;
      }
      startDate = parsedStart;

      closingDate = new Date(closingAt);
      if (isNaN(closingDate.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Auction closing date and time must be a valid timestamp.',
        });
        return;
      }
    } else if (duration === '1d' || duration === '1 day') {
      if (startTime !== undefined && startTime !== null && startTime !== '') {
        const parsedStart = new Date(startTime);
        if (!isNaN(parsedStart.getTime())) startDate = parsedStart;
      }
      closingDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    } else if (duration === '3d' || duration === '3 days') {
      if (startTime !== undefined && startTime !== null && startTime !== '') {
        const parsedStart = new Date(startTime);
        if (!isNaN(parsedStart.getTime())) startDate = parsedStart;
      }
      closingDate = new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000);
    } else if (duration === '7d' || duration === '1w' || duration === '1 week') {
      if (startTime !== undefined && startTime !== null && startTime !== '') {
        const parsedStart = new Date(startTime);
        if (!isNaN(parsedStart.getTime())) startDate = parsedStart;
      }
      closingDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else if (closingAt) {
      if (startTime !== undefined && startTime !== null && startTime !== '') {
        const parsedStart = new Date(startTime);
        if (isNaN(parsedStart.getTime())) {
          res.status(400).json({
            success: false,
            message: 'Auction opening date and time must be a valid timestamp.',
          });
          return;
        }
        if (parsedStart.getTime() < now.getTime() - 60_000) {
          res.status(400).json({
            success: false,
            message: 'Auction opening date and time cannot be set in the past.',
          });
          return;
        }
        startDate = parsedStart;
      }

      closingDate = new Date(closingAt);
      if (isNaN(closingDate.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Auction closing date and time must be a valid timestamp.',
        });
        return;
      }
    } else {
      res.status(400).json({
        success: false,
        message: 'A valid duration or closing time must be provided.',
      });
      return;
    }

    if (closingDate.getTime() <= startDate.getTime()) {
      res.status(400).json({
        success: false,
        message: 'Auction closing time must be after opening time.',
      });
      return;
    }

    if (closingDate.getTime() <= now.getTime()) {
      res.status(400).json({
        success: false,
        message: 'Auction closing date and time must be set in the future.',
      });
      return;
    }

    // Determine lifecycle status: scheduled if opening in future, active if opening now
    const isScheduled = startDate.getTime() > now.getTime();
    const initialStatus = isScheduled ? 'scheduled' : 'active';

    const auction = await Auction.create({
      sellerId: req.user._id,
      title: title.trim(),
      description: description.trim(),
      category,
      condition,
      startingPrice: Math.floor(priceNum),
      minimumBidIncrement: Math.floor(incrementNum),
      startTime: startDate,
      closingAt: closingDate,
      imageUrls: Array.isArray(imageUrls) ? imageUrls.slice(0, 5) : [],
      status: initialStatus,
      currentLeadingBid: 0,
      bidCount: 0,
    });

    const populatedAuction = await Auction.findById(auction._id)
      .populate('sellerId', 'fullName department year createdAt')
      .lean();

    broadcastAuctionUpdate(auction._id.toString(), 'auction_created', populatedAuction);

    // If auction opens immediately, asynchronously scan and alert active saved wants
    if (initialStatus === 'active') {
      checkNewListingMatches(auction).catch((err) =>
        console.error('[Want Matching Error on Create Auction]', err)
      );
    }

    res.status(201).json({
      success: true,
      message: isScheduled
        ? 'Auction listing scheduled successfully.'
        : 'Auction listing published successfully to campus marketplace.',
      auction: populatedAuction,
    });
  } catch (error: any) {
    console.error('[Create Auction Error]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create auction listing.',
    });
  }
};

export const updateAuction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const {
      title,
      description,
      category,
      condition,
      startingPrice,
      minimumBidIncrement,
      startTime,
      closingAt,
    } = req.body;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid auction ID.' });
      return;
    }

    const auction = await Auction.findById(id);
    if (!auction) {
      res.status(404).json({ success: false, message: 'Auction listing not found.' });
      return;
    }

    // Verify ownership
    if (!auction.sellerId.equals(req.user._id)) {
      res.status(403).json({
        success: false,
        message: 'Access denied: You can only edit your own listings.',
      });
      return;
    }

    if (auction.status !== 'active' && auction.status !== 'scheduled') {
      res.status(400).json({
        success: false,
        message: `Cannot edit listing because auction is currently ${auction.status}.`,
      });
      return;
    }

    // FAIRNESS RULE: If auction has received its first bid, reject changing protected fields
    if (auction.bidCount > 0) {
      if (
        startingPrice !== undefined &&
        Number(startingPrice) !== auction.startingPrice
      ) {
        res.status(400).json({
          success: false,
          message: 'Cannot change starting price after bids have already been placed.',
        });
        return;
      }

      if (
        minimumBidIncrement !== undefined &&
        Number(minimumBidIncrement) !== auction.minimumBidIncrement
      ) {
        res.status(400).json({
          success: false,
          message: 'Cannot change minimum bid increment after bids have already been placed.',
        });
        return;
      }

      if (startTime !== undefined) {
        const newStart = new Date(startTime);
        if (newStart.getTime() !== new Date(auction.startTime).getTime()) {
          res.status(400).json({
            success: false,
            message: 'Cannot change opening time after bids have already been placed.',
          });
          return;
        }
      }

      if (closingAt !== undefined) {
        const newClosing = new Date(closingAt);
        if (newClosing.getTime() !== new Date(auction.closingAt).getTime()) {
          res.status(400).json({
            success: false,
            message: 'Cannot change closing time after bids have already been placed.',
          });
          return;
        }
      }
    }

    // Update allowable fields
    if (title) auction.title = title.trim();
    if (description) auction.description = description.trim();
    if (condition) auction.condition = condition;

    // Only allow changing pricing and schedule timing if no bids exist yet
    if (auction.bidCount === 0) {
      if (category) auction.category = category;
      if (startingPrice && Number(startingPrice) > 0) {
        auction.startingPrice = Math.floor(Number(startingPrice));
      }
      if (minimumBidIncrement && Number(minimumBidIncrement) > 0) {
        auction.minimumBidIncrement = Math.floor(Number(minimumBidIncrement));
      }

      if (startTime !== undefined || closingAt !== undefined) {
        const now = new Date();
        const newStart =
          startTime !== undefined ? new Date(startTime) : new Date(auction.startTime || now);
        const newClosing =
          closingAt !== undefined ? new Date(closingAt) : new Date(auction.closingAt);

        if (isNaN(newStart.getTime()) || isNaN(newClosing.getTime())) {
          res.status(400).json({
            success: false,
            message: 'Auction opening and closing times must be valid timestamps.',
          });
          return;
        }

        if (newClosing.getTime() <= newStart.getTime()) {
          res.status(400).json({
            success: false,
            message: 'Auction closing time must be later than opening time.',
          });
          return;
        }

        if (newClosing.getTime() <= now.getTime()) {
          res.status(400).json({
            success: false,
            message: 'Auction closing date and time must be set in the future.',
          });
          return;
        }

        auction.startTime = newStart;
        auction.closingAt = newClosing;

        if (newStart.getTime() > now.getTime()) {
          auction.status = 'scheduled';
        } else {
          auction.status = 'active';
        }
      }
    }

    await auction.save();

    const updated = await Auction.findById(id)
      .populate('sellerId', 'fullName department year createdAt')
      .populate('currentLeadingBidderId', 'fullName');

    res.status(200).json({
      success: true,
      message: 'Listing updated successfully.',
      auction: updated,
    });
  } catch (error: any) {
    console.error('[Update Auction Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update auction.',
    });
  }
};

export const cancelAuction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid auction ID.' });
      return;
    }

    const auction = await Auction.findById(id);
    if (!auction) {
      res.status(404).json({ success: false, message: 'Auction listing not found.' });
      return;
    }

    // Verify ownership
    if (!auction.sellerId.equals(req.user._id)) {
      res.status(403).json({
        success: false,
        message: 'Access denied: You can only cancel your own listings.',
      });
      return;
    }

    // FAIRNESS RULE: Cannot cancel after first valid bid
    if (auction.bidCount > 0) {
      res.status(400).json({
        success: false,
        message: 'Fairness Policy: You cannot cancel an auction after it has received its first valid bid.',
      });
      return;
    }

    auction.status = 'cancelled';
    await auction.save();

    broadcastAuctionUpdate(auction._id.toString(), 'auction_cancelled', { id: auction._id });

    res.status(200).json({
      success: true,
      message: 'Auction has been successfully cancelled.',
      auction,
    });
  } catch (error: any) {
    console.error('[Cancel Auction Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel auction.',
    });
  }
};

export const getMyListings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const listings = await Auction.find({ sellerId: req.user._id })
      .populate('currentLeadingBidderId', 'fullName')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: listings.length,
      listings,
    });
  } catch (error: any) {
    console.error('[Get My Listings Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your listings.',
    });
  }
};
