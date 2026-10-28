import { Router } from 'express';
import {
  getAuctions,
  getAuctionById,
  createAuction,
  updateAuction,
  cancelAuction,
  getMyListings,
} from '../controllers/auctionController.js';
import { placeBid, getAuctionBids } from '../controllers/bidController.js';
import { getAuctionQuestions, createQuestion } from '../controllers/questionController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Publicly browse listings
router.get('/', getAuctions);

// Student's own listings (Must precede /:id)
router.get('/my-listings', authenticate, getMyListings);

// Get single auction details
router.get('/:id', getAuctionById);

// Public bid history of an auction
router.get('/:id/bids', getAuctionBids);

// Public Questions & Answers of an auction
router.get('/:auctionId/questions', optionalAuth, getAuctionQuestions);

// Submit Question on an auction
router.post('/:auctionId/questions', authenticate, createQuestion);

// Place bid on an auction
router.post('/:id/bids', authenticate, placeBid);

// Create new auction listing
router.post('/', authenticate, createAuction);

// Edit auction details
router.patch('/:id', authenticate, updateAuction);

// Cancel auction (only if no bids placed)
router.delete('/:id', authenticate, cancelAuction);

export default router;
