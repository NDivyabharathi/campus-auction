import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.js';
import { Want, IWant } from '../models/Want.js';
import { WantMatch } from '../models/WantMatch.js';
import { checkExistingListingsForWant } from '../services/wantService.js';

const VALID_CATEGORIES = [
  'Books and Study Materials',
  'Electronics',
  'Cycles and Transportation',
  'Hostel Essentials',
  'Clothing and Accessories',
  'Sports Equipment',
  'Laboratory Equipment',
  'Other',
];

const VALID_CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Heavily Used'];
const MAX_ACTIVE_WANTS = 10;

/**
 * POST /api/wants
 * Create a new Want and check existing listings immediately
 */
export const createWant = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const { keywords, category, maxPrice, condition } = req.body;

    // 1. Check max active wants limit (10)
    const activeCount = await Want.countDocuments({
      student: req.user._id,
      status: 'ACTIVE',
      expiresAt: { $gt: new Date() },
    });

    if (activeCount >= MAX_ACTIVE_WANTS) {
      res.status(400).json({
        success: false,
        message: `You have reached the maximum limit of ${MAX_ACTIVE_WANTS} active saved wants. Please pause, fulfill, or delete an existing want first.`,
      });
      return;
    }

    // 2. Validate keywords
    const cleanKeywords = typeof keywords === 'string' ? keywords.trim() : '';
    if (cleanKeywords.length < 2 || cleanKeywords.length > 100) {
      res.status(400).json({
        success: false,
        message: 'Keywords must be between 2 and 100 characters.',
      });
      return;
    }

    // 3. Validate optional category
    if (category && !VALID_CATEGORIES.includes(category)) {
      res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
      });
      return;
    }

    // 4. Validate optional max starting price
    let parsedMaxPrice: number | undefined = undefined;
    if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
      parsedMaxPrice = Number(maxPrice);
      if (isNaN(parsedMaxPrice) || parsedMaxPrice <= 0) {
        res.status(400).json({
          success: false,
          message: 'Maximum starting price must be a valid positive number greater than zero.',
        });
        return;
      }
    }

    // 5. Validate optional condition
    if (condition && !VALID_CONDITIONS.includes(condition)) {
      res.status(400).json({
        success: false,
        message: `Invalid condition. Must be one of: ${VALID_CONDITIONS.join(', ')}`,
      });
      return;
    }

    // 6. Create Want with 30 days expiration
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const want = await Want.create({
      student: req.user._id,
      keywords: cleanKeywords,
      category: category || undefined,
      maxPrice: parsedMaxPrice,
      condition: condition || undefined,
      status: 'ACTIVE',
      expiresAt,
    });

    // 7. Check existing active listings immediately
    const { matchedListings, newMatchesCount } = await checkExistingListingsForWant(want._id.toString());

    res.status(201).json({
      success: true,
      message: `Want saved successfully! Found ${newMatchesCount} immediate matching listing(s).`,
      want,
      initialMatchesCount: newMatchesCount,
    });
  } catch (error: any) {
    console.error('[Create Want Error]', error);
    res.status(500).json({ success: false, message: 'Failed to create saved want.' });
  }
};

/**
 * GET /api/wants
 * Retrieve the authenticated student's saved wants
 */
export const getStudentWants = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const now = new Date();

    // Find all wants owned by the student
    const wants = await Want.find({ student: req.user._id }).sort({ createdAt: -1 });

    // Update any lazily expired wants
    for (const want of wants) {
      if (want.status === 'ACTIVE' && new Date(want.expiresAt) <= now) {
        want.status = 'EXPIRED';
        await want.save();
      }
    }

    const activeCount = wants.filter((w) => w.status === 'ACTIVE' && new Date(w.expiresAt) > now).length;

    res.status(200).json({
      success: true,
      activeCount,
      maxActiveLimit: MAX_ACTIVE_WANTS,
      wants,
    });
  } catch (error: any) {
    console.error('[Get Wants Error]', error);
    res.status(500).json({ success: false, message: 'Failed to fetch saved wants.' });
  }
};

/**
 * GET /api/wants/:id
 * Retrieve a specific owned want with populated matches
 */
export const getWantById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid want ID.' });
      return;
    }

    const want = await Want.findById(id);
    if (!want) {
      res.status(404).json({ success: false, message: 'Want not found.' });
      return;
    }

    // Strict ownership verification
    if (!want.student.equals(req.user._id)) {
      res.status(403).json({ success: false, message: 'Forbidden: You cannot access another student’s want.' });
      return;
    }

    // Check expiration
    if (want.status === 'ACTIVE' && new Date(want.expiresAt) <= new Date()) {
      want.status = 'EXPIRED';
      await want.save();
    }

    const matches = await WantMatch.find({ want: want._id })
      .populate('listing')
      .sort({ matchedAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      want,
      matches,
    });
  } catch (error: any) {
    console.error('[Get Want By Id Error]', error);
    res.status(500).json({ success: false, message: 'Failed to fetch want details.' });
  }
};

/**
 * PATCH /api/wants/:id
 * Pause or resume a saved want
 */
export const toggleWantStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const { status } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid want ID.' });
      return;
    }

    if (!['ACTIVE', 'PAUSED'].includes(status)) {
      res.status(400).json({ success: false, message: 'Status must be either ACTIVE or PAUSED.' });
      return;
    }

    const want = await Want.findById(id);
    if (!want) {
      res.status(404).json({ success: false, message: 'Want not found.' });
      return;
    }

    // Strict ownership
    if (!want.student.equals(req.user._id)) {
      res.status(403).json({ success: false, message: 'Forbidden: You cannot modify another student’s want.' });
      return;
    }

    if (status === 'ACTIVE') {
      // Check if expired
      if (new Date(want.expiresAt) <= new Date()) {
        res.status(400).json({
          success: false,
          message: 'Cannot resume an expired want. Please renew it for 30 days instead.',
        });
        return;
      }

      // Check max active wants limit
      const activeCount = await Want.countDocuments({
        student: req.user._id,
        status: 'ACTIVE',
        expiresAt: { $gt: new Date() },
        _id: { $ne: want._id },
      });

      if (activeCount >= MAX_ACTIVE_WANTS) {
        res.status(400).json({
          success: false,
          message: `Active want limit (${MAX_ACTIVE_WANTS}) reached. Pause or delete another want first.`,
        });
        return;
      }

      want.status = 'ACTIVE';
      await want.save();

      // On resumption, check current active listings again
      await checkExistingListingsForWant(want._id.toString());
    } else {
      want.status = 'PAUSED';
      await want.save();
    }

    res.status(200).json({
      success: true,
      message: `Want has been ${status === 'ACTIVE' ? 'resumed' : 'paused'}.`,
      want,
    });
  } catch (error: any) {
    console.error('[Toggle Want Status Error]', error);
    res.status(500).json({ success: false, message: 'Failed to update want status.' });
  }
};

/**
 * POST /api/wants/:id/renew
 * Renew an expired want for another 30 days
 */
export const renewWant = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid want ID.' });
      return;
    }

    const want = await Want.findById(id);
    if (!want) {
      res.status(404).json({ success: false, message: 'Want not found.' });
      return;
    }

    // Ownership check
    if (!want.student.equals(req.user._id)) {
      res.status(403).json({ success: false, message: 'Forbidden: You cannot renew another student’s want.' });
      return;
    }

    // Check active limit
    const activeCount = await Want.countDocuments({
      student: req.user._id,
      status: 'ACTIVE',
      expiresAt: { $gt: new Date() },
      _id: { $ne: want._id },
    });

    if (activeCount >= MAX_ACTIVE_WANTS) {
      res.status(400).json({
        success: false,
        message: `Cannot renew: you have reached the maximum of ${MAX_ACTIVE_WANTS} active wants.`,
      });
      return;
    }

    // Renew for 30 days
    want.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    want.status = 'ACTIVE';
    await want.save();

    // Check active listings again (respecting unique compound index to avoid duplicates)
    const { newMatchesCount } = await checkExistingListingsForWant(want._id.toString());

    res.status(200).json({
      success: true,
      message: `Want renewed for 30 days! Found ${newMatchesCount} new matching item(s).`,
      want,
    });
  } catch (error: any) {
    console.error('[Renew Want Error]', error);
    res.status(500).json({ success: false, message: 'Failed to renew want.' });
  }
};

/**
 * POST /api/wants/:id/fulfill
 * Mark a want as FULFILLED
 */
export const fulfillWant = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid want ID.' });
      return;
    }

    const want = await Want.findById(id);
    if (!want) {
      res.status(404).json({ success: false, message: 'Want not found.' });
      return;
    }

    if (!want.student.equals(req.user._id)) {
      res.status(403).json({ success: false, message: 'Forbidden.' });
      return;
    }

    want.status = 'FULFILLED';
    want.fulfilledAt = new Date();
    await want.save();

    res.status(200).json({
      success: true,
      message: 'Want marked as fulfilled. Congratulations on finding your campus item!',
      want,
    });
  } catch (error: any) {
    console.error('[Fulfill Want Error]', error);
    res.status(500).json({ success: false, message: 'Failed to fulfill want.' });
  }
};

/**
 * DELETE /api/wants/:id
 * Delete an owned want and its associated match records
 */
export const deleteWant = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid want ID.' });
      return;
    }

    const want = await Want.findById(id);
    if (!want) {
      res.status(404).json({ success: false, message: 'Want not found.' });
      return;
    }

    if (!want.student.equals(req.user._id)) {
      res.status(403).json({ success: false, message: 'Forbidden: You cannot delete another student’s want.' });
      return;
    }

    await Want.findByIdAndDelete(want._id);
    await WantMatch.deleteMany({ want: want._id });

    res.status(200).json({
      success: true,
      message: 'Saved want and associated matches removed successfully.',
    });
  } catch (error: any) {
    console.error('[Delete Want Error]', error);
    res.status(500).json({ success: false, message: 'Failed to delete want.' });
  }
};

/**
 * GET /api/wants/:id/matches
 * Retrieve paginated matches for a want
 */
export const getWantMatches = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '10', 10);
    const skip = (page - 1) * limit;

    const want = await Want.findById(id);
    if (!want) {
      res.status(404).json({ success: false, message: 'Want not found.' });
      return;
    }

    if (!want.student.equals(req.user._id)) {
      res.status(403).json({ success: false, message: 'Forbidden.' });
      return;
    }

    const total = await WantMatch.countDocuments({ want: want._id });
    const matches = await WantMatch.find({ want: want._id })
      .populate('listing')
      .sort({ matchedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      want,
      total,
      page,
      pages: Math.ceil(total / limit),
      matches,
    });
  } catch (error: any) {
    console.error('[Get Want Matches Error]', error);
    res.status(500).json({ success: false, message: 'Failed to fetch want matches.' });
  }
};
