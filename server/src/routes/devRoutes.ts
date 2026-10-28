import { Router, Request, Response } from 'express';
import { devFastForwardAuction } from '../controllers/transactionController.js';
import { ENV } from '../config/env.js';

const router = Router();

// Development-only demo helper to fast-forward auctions or expire handovers
router.use((_req: Request, res: Response, next) => {
  if (ENV.NODE_ENV === 'production') {
    res.status(403).json({ success: false, message: 'Dev routes disabled in production mode.' });
    return;
  }
  next();
});

router.post('/close-auction/:id', devFastForwardAuction);

export default router;
