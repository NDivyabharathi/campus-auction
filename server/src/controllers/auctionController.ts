import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Auction, IAuction } from '../models/Auction.js';
import { AuthRequest } from '../middleware/auth.js';
import { broadcastAuctionUpdate } from '../socket.js';
import { processAuctionClosure } from '../services/auctionClosureService.js';

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

    // Check on-the-fly for any expired active auctions
    const now = new Date();
    const updatedAuctions = await Promise.all(
      auctions.map(async (auc) => {
        if (auc.status === 'active' && new Date(auc.closingAt) <= now) {
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

    // If active and past deadline, close immediately
    if (auction.status === 'active' && new Date(auction.closingAt) <= new Date()) {
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
      closingAt,
      imageUrls,
    } = req.body;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    // Validation
    if (!title || !description || !category || !condition || !startingPrice || !closingAt) {
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

    const closingDate = new Date(closingAt);
    if (isNaN(closingDate.getTime()) || closingDate <= new Date()) {
      res.status(400).json({
        success: false,
        message: 'Auction closing date and time must be set in the future.',
      });
      return;
    }

    const auction = await Auction.create({
      sellerId: req.user._id,
      title: title.trim(),
      description: description.trim(),
      category,
      condition,
      startingPrice: Math.floor(priceNum),
      minimumBidIncrement: Math.floor(incrementNum),
      closingAt: closingDate,
      imageUrls: Array.isArray(imageUrls) ? imageUrls.slice(0, 5) : [],
      status: 'active',
      currentLeadingBid: 0,
      bidCount: 0,
    });

    const populatedAuction = await Auction.findById(auction._id)
      .populate('sellerId', 'fullName department year createdAt')
      .lean();

    broadcastAuctionUpdate(auction._id.toString(), 'auction_created', populatedAuction);

    res.status(201).json({
      success: true,
      message: 'Auction listing published successfully to campus marketplace.',
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
    const { title, description, category, condition, startingPrice, minimumBidIncrement, closingAt } =
      req.body;

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

    if (auction.status !== 'active') {
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

    // Only allow changing pricing and closing time if no bids exist yet
    if (auction.bidCount === 0) {
      if (category) auction.category = category;
      if (startingPrice && Number(startingPrice) > 0) {
        auction.startingPrice = Math.floor(Number(startingPrice));
      }
      if (minimumBidIncrement && Number(minimumBidIncrement) > 0) {
        auction.minimumBidIncrement = Math.floor(Number(minimumBidIncrement));
      }
      if (closingAt) {
        const newClosing = new Date(closingAt);
        if (newClosing > new Date()) {
          auction.closingAt = newClosing;
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
