import { Router } from 'express';
import {
  getAuctions,
  getAuctionById,
  createAuction,
  updateAuction,
  cancelAuction,
  getMyListings,
} from '../controllers/auctionController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Publicly browse listings
router.get('/', getAuctions);

// Student's own listings (Must precede /:id)
router.get('/my-listings', authenticate, getMyListings);

// Get single auction details
router.get('/:id', getAuctionById);

// Create new auction listing
router.post('/', authenticate, createAuction);

// Edit auction details
router.patch('/:id', authenticate, updateAuction);

// Cancel auction (only if no bids placed)
router.delete('/:id', authenticate, cancelAuction);

export default router;
