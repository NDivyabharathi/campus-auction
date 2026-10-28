import mongoose, { Document, Schema } from 'mongoose';
import { AuctionCategory, ItemCondition } from './Auction.js';

export type WantStatus = 'ACTIVE' | 'PAUSED' | 'FULFILLED' | 'EXPIRED';

export interface IWant extends Document {
  student: mongoose.Types.ObjectId;
  keywords: string;
  category?: AuctionCategory;
  maxPrice?: number;
  condition?: ItemCondition;
  status: WantStatus;
  matchCount: number;
  expiresAt: Date;
  fulfilledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const wantSchema = new Schema<IWant>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student owner is required'],
      index: true,
    },
    keywords: {
      type: String,
      required: [true, 'Keywords are required'],
      trim: true,
      minlength: [2, 'Keywords must be at least 2 characters'],
      maxlength: [100, 'Keywords cannot exceed 100 characters'],
    },
    category: {
      type: String,
      enum: [
        'Books and Study Materials',
        'Electronics',
        'Cycles and Transportation',
        'Hostel Essentials',
        'Clothing and Accessories',
        'Sports Equipment',
        'Laboratory Equipment',
        'Other',
      ],
      required: false,
    },
    maxPrice: {
      type: Number,
      required: false,
      min: [1, 'Maximum price must be greater than zero'],
    },
    condition: {
      type: String,
      enum: ['New', 'Like New', 'Good', 'Fair', 'Heavily Used'],
      required: false,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'PAUSED', 'FULFILLED', 'EXPIRED'],
      default: 'ACTIVE',
      index: true,
    },
    matchCount: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      index: true,
    },
    fulfilledAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

wantSchema.index({ student: 1, status: 1 });
wantSchema.index({ status: 1, expiresAt: 1 });
wantSchema.index({ student: 1, createdAt: -1 });

export const Want = mongoose.model<IWant>('Want', wantSchema);
