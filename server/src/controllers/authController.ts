import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { ENV } from '../config/env.js';
import { AuthRequest } from '../middleware/auth.js';

const KONGU_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@kongu\.edu$/;

const generateToken = (userId: string): string => {
  return jwt.sign({ id: userId }, ENV.JWT_SECRET, {
    expiresIn: '7d',
  });
};

const setAuthCookie = (res: Response, token: string) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: ENV.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, email, password, confirmPassword, department, year } = req.body;

    if (!fullName || !email || !password) {
      res.status(400).json({
        success: false,
        message: 'Full name, Kongu email, and password are required.',
      });
      return;
    }

    const trimmedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // Enforce campus email restriction
    if (!KONGU_EMAIL_REGEX.test(normalizedEmail)) {
      res.status(400).json({
        success: false,
        message: 'Registration is restricted strictly to Kongu Engineering College emails ending in @kongu.edu',
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
      return;
    }

    if (confirmPassword && password !== confirmPassword) {
      res.status(400).json({
        success: false,
        message: 'Passwords do not match.',
      });
      return;
    }

    // Check duplicate email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'An account with this @kongu.edu email already exists. Please log in.',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName: trimmedName,
      email: normalizedEmail,
      passwordHash,
      department: department?.trim() || '',
      year: year ? Number(year) : undefined,
    });

    const token = generateToken(user._id.toString());
    setAuthCookie(res, token);

    res.status(201).json({
      success: true,
      message: 'Account successfully registered for Kongu Campus Auction.',
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        department: user.department,
        year: user.year,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[Register Error]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration.',
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Verify campus email domain
    if (!KONGU_EMAIL_REGEX.test(normalizedEmail)) {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid @kongu.edu college email address.',
      });
      return;
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email address or password.',
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Invalid email address or password.',
      });
      return;
    }

    const token = generateToken(user._id.toString());
    setAuthCookie(res, token);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        department: user.department,
        year: user.year,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[Login Error]', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login.',
    });
  }
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: ENV.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Not authenticated.',
    });
    return;
  }

  res.status(200).json({
    success: true,
    user: req.user,
  });
};
