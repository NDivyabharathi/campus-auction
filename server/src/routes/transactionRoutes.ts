import { Router } from 'express';
import {
  getMyTransactions,
  getTransactionById,
  updateHandoverDetails,
  confirmHandover,
  failAndReassign,
} from '../controllers/transactionController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Student's transaction list (as buyer or seller)
router.get('/', authenticate, getMyTransactions);

// Single transaction details
router.get('/:id', authenticate, getTransactionById);

// Update handover location, date/time, and notes
router.patch('/:id/handover', authenticate, updateHandoverDetails);

// Two-party physical handover confirmation
router.post('/:id/confirm', authenticate, confirmHandover);

// Mark transaction failed & automatically reassign to next eligible bidder
router.post('/:id/fail-and-reassign', authenticate, failAndReassign);

export default router;
