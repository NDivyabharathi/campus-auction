import mongoose, { Document, Schema } from 'mongoose';

export type AutoBidStatus = 'active' | 'paused' | 'disabled';

export interface IAutoBid extends Document {
  auctionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  maxAmount: number;
  status: AutoBidStatus;
  maxRegisteredAt: Date;
  lastAutoBidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const autoBidSchema = new Schema<IAutoBid>(
  {
    auctionId: {
      type: Schema.Types.ObjectId,
      ref: 'Auction',
      required: [true, 'Auction ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    maxAmount: {
      type: Number,
      required: [true, 'Maximum bid amount is required'],
      min: [1, 'Maximum bid amount must be greater than zero'],
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'disabled'],
      default: 'active',
      index: true,
    },
    maxRegisteredAt: {
      type: Date,
      default: Date.now,
    },
    lastAutoBidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// One active or configured auto-bid per student per auction
autoBidSchema.index({ auctionId: 1, userId: 1 }, { unique: true });

// Query index for deterministic proxy engine resolution (highest max, earliest registration)
autoBidSchema.index({ auctionId: 1, status: 1, maxAmount: -1, maxRegisteredAt: 1 });

export const AutoBid = mongoose.model<IAutoBid>('AutoBid', autoBidSchema);
