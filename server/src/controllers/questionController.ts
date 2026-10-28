import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.js';
import { Auction } from '../models/Auction.js';
import { Question, IQuestion, IAnswer } from '../models/Question.js';
import { createNotification } from '../services/notificationService.js';
import { broadcastAuctionUpdate } from '../socket.js';
import {
  checkRateLimit,
  QUESTION_RATE_LIMIT,
  ANSWER_RATE_LIMIT,
  RATE_LIMIT_WINDOW_MS,
} from '../utils/rateLimiter.js';

/**
 * Format a populated question document with safe boolean flags and role indicators
 */
function formatQuestionPayload(question: any, auction: any, currentUserId?: string) {
  const isAuctionActive = auction.status === 'active' && new Date(auction.closingAt) > new Date();
  const authorIdStr = question.authorId?._id ? question.authorId._id.toString() : question.authorId?.toString();
  const sellerIdStr = auction.sellerId?._id ? auction.sellerId._id.toString() : auction.sellerId?.toString();

  const isAuthor = currentUserId ? authorIdStr === currentUserId : false;
  const isSeller = authorIdStr === sellerIdStr;
  const hasAnswers = question.answers && question.answers.length > 0;
  const canEditDelete = isAuthor && !hasAnswers && isAuctionActive;

  const formattedAnswers = (question.answers || []).map((ans: any) => {
    const ansAuthorStr = ans.authorId?._id ? ans.authorId._id.toString() : ans.authorId?.toString();
    return {
      _id: ans._id ? ans._id.toString() : undefined,
      text: ans.text,
      authorId: ans.authorId,
      isSeller: ansAuthorStr === sellerIdStr,
      createdAt: ans.createdAt,
      updatedAt: ans.updatedAt,
    };
  });

  return {
    _id: question._id.toString(),
    auctionId: question.auctionId.toString(),
    text: question.text,
    authorId: question.authorId,
    answers: formattedAnswers,
    isAuthor,
    isSeller,
    canEditDelete,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  };
}

/**
 * GET /api/auctions/:auctionId/questions
 * Publicly retrieve all questions & answers for an auction
 */
export const getAuctionQuestions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rawId = req.params.auctionId;
    const auctionId = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!auctionId || !mongoose.Types.ObjectId.isValid(auctionId)) {
      res.status(400).json({ success: false, message: 'Invalid auction ID format.' });
      return;
    }

    const auction = await Auction.findById(auctionId).select('sellerId status closingAt');
    if (!auction) {
      res.status(404).json({ success: false, message: 'Auction listing not found.' });
      return;
    }

    const questions = await Question.find({ auctionId })
      .populate('authorId', 'fullName department year')
      .populate('answers.authorId', 'fullName department year')
      .sort({ createdAt: -1 })
      .lean();

    const currentUserId = req.user ? req.user._id.toString() : undefined;
    const formatted = questions.map((q) => formatQuestionPayload(q, auction, currentUserId));

    res.status(200).json({
      success: true,
      count: formatted.length,
      questions: formatted,
    });
  } catch (error: any) {
    console.error('[Get Questions Error]', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve auction questions.' });
  }
};

/**
 * POST /api/auctions/:auctionId/questions
 * Submit a question on an active auction
 */
export const createQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required to ask a question.' });
      return;
    }

    const rawId = req.params.auctionId;
    const auctionId = Array.isArray(rawId) ? rawId[0] : rawId;
    const { text } = req.body;

    if (!auctionId || !mongoose.Types.ObjectId.isValid(auctionId)) {
      res.status(400).json({ success: false, message: 'Invalid auction ID format.' });
      return;
    }

    const cleanText = typeof text === 'string' ? text.trim() : '';
    if (cleanText.length < 3) {
      res.status(400).json({ success: false, message: 'Question must be at least 3 characters.' });
      return;
    }
    if (cleanText.length > 500) {
      res.status(400).json({ success: false, message: 'Question cannot exceed 500 characters.' });
      return;
    }

    // Rate limiting check
    const rateCheck = checkRateLimit(`question:${req.user._id}`, QUESTION_RATE_LIMIT, RATE_LIMIT_WINDOW_MS);
    if (!rateCheck.allowed) {
      res.status(429).json({
        success: false,
        message: `Rate limit reached. Please wait ${rateCheck.retryAfterSeconds}s before submitting another question.`,
      });
      return;
    }

    const auction = await Auction.findById(auctionId);
    if (!auction) {
      res.status(404).json({ success: false, message: 'Auction listing not found.' });
      return;
    }

    // Server-authoritative closing check
    const now = new Date();
    if (auction.status !== 'active' || new Date(auction.closingAt) <= now) {
      res.status(400).json({
        success: false,
        message: 'Questions are closed because this auction is no longer active.',
      });
      return;
    }

    // Create Question
    const question = await Question.create({
      auctionId: auction._id,
      authorId: req.user._id,
      text: cleanText,
    });

    const populated = await Question.findById(question._id)
      .populate('authorId', 'fullName department year')
      .lean();

    const formatted = formatQuestionPayload(populated, auction, req.user._id.toString());

    // Notify seller if asker is not the seller
    if (!auction.sellerId.equals(req.user._id)) {
      try {
        await createNotification({
          recipientId: auction.sellerId.toString(),
          type: 'question_asked',
          title: 'New question about your listing',
          message: `${req.user.fullName} asked: "${cleanText.slice(0, 80)}${cleanText.length > 80 ? '...' : ''}" on "${auction.title}"`,
          auctionId: auction._id.toString(),
          actorId: req.user._id.toString(),
          deduplicationKey: `question_${question._id}`,
        });
      } catch (err) {
        console.error('[Notification Error on Question]', err);
      }
    }

    // Broadcast real-time update
    broadcastAuctionUpdate(auction._id.toString(), 'new_question', formatted);

    res.status(201).json({
      success: true,
      message: 'Question posted successfully.',
      question: formatted,
    });
  } catch (error: any) {
    console.error('[Create Question Error]', error);
    res.status(500).json({ success: false, message: 'Failed to post question.' });
  }
};

/**
 * PATCH /api/questions/:questionId
 * Edit an unanswered question by its author
 */
export const editQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const rawId = req.params.questionId;
    const questionId = Array.isArray(rawId) ? rawId[0] : rawId;
    const { text } = req.body;

    if (!questionId || !mongoose.Types.ObjectId.isValid(questionId)) {
      res.status(400).json({ success: false, message: 'Invalid question ID format.' });
      return;
    }

    const cleanText = typeof text === 'string' ? text.trim() : '';
    if (cleanText.length < 3) {
      res.status(400).json({ success: false, message: 'Question must be at least 3 characters.' });
      return;
    }
    if (cleanText.length > 500) {
      res.status(400).json({ success: false, message: 'Question cannot exceed 500 characters.' });
      return;
    }

    const question = await Question.findById(questionId);
    if (!question) {
      res.status(404).json({ success: false, message: 'Question not found.' });
      return;
    }

    // Strict ownership verification
    if (!question.authorId.equals(req.user._id)) {
      res.status(403).json({ success: false, message: 'Forbidden: You can only edit your own question.' });
      return;
    }

    // Cannot edit if already answered
    if (question.answers && question.answers.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Question cannot be edited because it already has public answers.',
      });
      return;
    }

    // Check auction active status
    const auction = await Auction.findById(question.auctionId);
    if (!auction || auction.status !== 'active' || new Date(auction.closingAt) <= new Date()) {
      res.status(400).json({
        success: false,
        message: 'Question cannot be edited because the auction has ended.',
      });
      return;
    }

    question.text = cleanText;
    question.updatedAt = new Date();
    await question.save();

    const populated = await Question.findById(question._id)
      .populate('authorId', 'fullName department year')
      .lean();

    const formatted = formatQuestionPayload(populated, auction, req.user._id.toString());
    broadcastAuctionUpdate(question.auctionId.toString(), 'question_updated', formatted);

    res.status(200).json({
      success: true,
      message: 'Question updated successfully.',
      question: formatted,
    });
  } catch (error: any) {
    console.error('[Edit Question Error]', error);
    res.status(500).json({ success: false, message: 'Failed to update question.' });
  }
};

/**
 * DELETE /api/questions/:questionId
 * Delete an unanswered question by its author
 */
export const deleteQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const rawId = req.params.questionId;
    const questionId = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!questionId || !mongoose.Types.ObjectId.isValid(questionId)) {
      res.status(400).json({ success: false, message: 'Invalid question ID format.' });
      return;
    }

    const question = await Question.findById(questionId);
    if (!question) {
      res.status(404).json({ success: false, message: 'Question not found.' });
      return;
    }

    // Strict ownership verification
    if (!question.authorId.equals(req.user._id)) {
      res.status(403).json({ success: false, message: 'Forbidden: You can only delete your own question.' });
      return;
    }

    // Cannot delete if already answered
    if (question.answers && question.answers.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Question cannot be deleted because it already has public answers.',
      });
      return;
    }

    const auctionId = question.auctionId.toString();
    await Question.findByIdAndDelete(questionId);

    broadcastAuctionUpdate(auctionId, 'question_deleted', { questionId });

    res.status(200).json({
      success: true,
      message: 'Question deleted successfully.',
    });
  } catch (error: any) {
    console.error('[Delete Question Error]', error);
    res.status(500).json({ success: false, message: 'Failed to delete question.' });
  }
};

/**
 * POST /api/questions/:questionId/answers
 * Submit an answer to a question (Seller or other student)
 */
export const createAnswer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required to post an answer.' });
      return;
    }

    const rawId = req.params.questionId;
    const questionId = Array.isArray(rawId) ? rawId[0] : rawId;
    const { text } = req.body;

    if (!questionId || !mongoose.Types.ObjectId.isValid(questionId)) {
      res.status(400).json({ success: false, message: 'Invalid question ID format.' });
      return;
    }

    const cleanText = typeof text === 'string' ? text.trim() : '';
    if (cleanText.length < 1) {
      res.status(400).json({ success: false, message: 'Answer text cannot be empty.' });
      return;
    }
    if (cleanText.length > 1000) {
      res.status(400).json({ success: false, message: 'Answer cannot exceed 1000 characters.' });
      return;
    }

    // Rate limiting check
    const rateCheck = checkRateLimit(`answer:${req.user._id}`, ANSWER_RATE_LIMIT, RATE_LIMIT_WINDOW_MS);
    if (!rateCheck.allowed) {
      res.status(429).json({
        success: false,
        message: `Rate limit reached. Please wait ${rateCheck.retryAfterSeconds}s before submitting another answer.`,
      });
      return;
    }

    const question = await Question.findById(questionId);
    if (!question) {
      res.status(404).json({ success: false, message: 'Question not found.' });
      return;
    }

    const auction = await Auction.findById(question.auctionId);
    if (!auction) {
      res.status(404).json({ success: false, message: 'Auction listing not found.' });
      return;
    }

    // Server-authoritative closing check
    const now = new Date();
    if (auction.status !== 'active' || new Date(auction.closingAt) <= now) {
      res.status(400).json({
        success: false,
        message: 'Answers cannot be submitted because this auction is closed.',
      });
      return;
    }

    // Append Answer
    const answerObj = {
      authorId: req.user._id,
      text: cleanText,
      createdAt: now,
      updatedAt: now,
    };

    question.answers.push(answerObj as any);
    await question.save();

    const populated = await Question.findById(question._id)
      .populate('authorId', 'fullName department year')
      .populate('answers.authorId', 'fullName department year')
      .lean();

    const formatted = formatQuestionPayload(populated, auction, req.user._id.toString());

    // Notify question author if respondent is different from the asker
    if (!question.authorId.equals(req.user._id)) {
      const isSellerRespondent = auction.sellerId.equals(req.user._id);
      const title = isSellerRespondent ? 'Seller replied to your question' : 'New answer to your question';
      const rolePrefix = isSellerRespondent ? `${req.user.fullName} (Seller)` : req.user.fullName;

      try {
        await createNotification({
          recipientId: question.authorId.toString(),
          type: 'answer_received',
          title,
          message: `${rolePrefix} answered: "${cleanText.slice(0, 80)}${cleanText.length > 80 ? '...' : ''}" on "${auction.title}"`,
          auctionId: auction._id.toString(),
          actorId: req.user._id.toString(),
          deduplicationKey: `answer_${question._id}_${Date.now()}`,
        });
      } catch (err) {
        console.error('[Notification Error on Answer]', err);
      }
    }

    // Broadcast real-time update
    broadcastAuctionUpdate(auction._id.toString(), 'new_answer', {
      questionId: question._id.toString(),
      question: formatted,
    });

    res.status(201).json({
      success: true,
      message: 'Answer posted successfully.',
      question: formatted,
    });
  } catch (error: any) {
    console.error('[Create Answer Error]', error);
    res.status(500).json({ success: false, message: 'Failed to post answer.' });
  }
};
