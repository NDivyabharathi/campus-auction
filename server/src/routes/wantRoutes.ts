import { Router } from 'express';
import {
  createWant,
  getStudentWants,
  getWantById,
  toggleWantStatus,
  renewWant,
  fulfillWant,
  deleteWant,
  getWantMatches,
} from '../controllers/wantController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All Want routes require authenticated student session
router.use(authenticate);

router.post('/', createWant);
router.get('/', getStudentWants);
router.get('/:id', getWantById);
router.patch('/:id', toggleWantStatus);
router.post('/:id/renew', renewWant);
router.post('/:id/fulfill', fulfillWant);
router.delete('/:id', deleteWant);
router.get('/:id/matches', getWantMatches);

export default router;

