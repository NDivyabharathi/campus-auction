import { Router } from 'express';
import {
  getAuctionQuestions,
  createQuestion,
  editQuestion,
  deleteQuestion,
  createAnswer,
} from '../controllers/questionController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Retrieve all questions for an auction
router.get('/auction/:auctionId', optionalAuth, getAuctionQuestions);

// Submit a new question
router.post('/auction/:auctionId', authenticate, createQuestion);

// Edit an unanswered question (Author only)
router.patch('/:questionId', authenticate, editQuestion);

// Delete an unanswered question (Author only)
router.delete('/:questionId', authenticate, deleteQuestion);

// Submit an answer to a question (Seller or other student)
router.post('/:questionId/answers', authenticate, createAnswer);

export default router;

