import { Router } from 'express';
import { placeBid, getAuctionBids, getMyBids } from '../controllers/bidController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Student's personal bid history
router.get('/my-bids', authenticate, getMyBids);

// Place a new bid on an auction
router.post('/auctions/:id/bids', authenticate, placeBid);

// Public bid history of an auction
router.get('/auctions/:id/bids', getAuctionBids);

export default router;
