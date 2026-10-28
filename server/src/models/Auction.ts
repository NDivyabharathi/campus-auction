import mongoose, { Document, Schema } from 'mongoose';

export type AuctionCategory =
  | 'Books and Study Materials'
  | 'Electronics'
  | 'Cycles and Transportation'
  | 'Hostel Essentials'
  | 'Clothing and Accessories'
  | 'Sports Equipment'
  | 'Laboratory Equipment'
  | 'Other';

export type ItemCondition = 'New' | 'Like New' | 'Good' | 'Fair' | 'Heavily Used';

export type AuctionStatus = 'active' | 'ended' | 'reserved' | 'sold' | 'unsold' | 'cancelled';

export interface IAuction extends Document {
  sellerId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  category: AuctionCategory;
  condition: ItemCondition;
  imageUrls: string[];
  startingPrice: number;
  minimumBidIncrement: number;
  closingAt: Date;
  status: AuctionStatus;
  currentLeadingBid: number;
  currentLeadingBidderId?: mongoose.Types.ObjectId | null;
  bidCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const auctionSchema = new Schema<IAuction>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
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
      index: true,
    },
    condition: {
      type: String,
      required: [true, 'Item condition is required'],
      enum: ['New', 'Like New', 'Good', 'Fair', 'Heavily Used'],
    },
    imageUrls: {
      type: [String],
      validate: {
        validator: function (val: string[]) {
          return val.length <= 5;
        },
        message: 'Maximum 5 images allowed per listing',
      },
      default: [],
    },
    startingPrice: {
      type: Number,
      required: [true, 'Starting price is required'],
      min: [1, 'Starting price must be greater than zero'],
    },
    minimumBidIncrement: {
      type: Number,
      required: [true, 'Minimum bid increment is required'],
      min: [1, 'Minimum bid increment must be greater than zero'],
      default: 10,
    },
    closingAt: {
      type: Date,
      required: [true, 'Closing date and time is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'ended', 'reserved', 'sold', 'unsold', 'cancelled'],
      default: 'active',
      index: true,
    },
    currentLeadingBid: {
      type: Number,
      default: 0,
    },
    currentLeadingBidderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    bidCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

auctionSchema.index({ status: 1, closingAt: 1 });
auctionSchema.index({ sellerId: 1, createdAt: -1 });

export const Auction = mongoose.model<IAuction>('Auction', auctionSchema);
