import mongoose, { Document, Schema } from 'mongoose';

export interface IBid extends Document {
  auctionId: mongoose.Types.ObjectId;
  bidderId: mongoose.Types.ObjectId;
  amount: number;
  createdAt: Date;
}

const bidSchema = new Schema<IBid>(
  {
    auctionId: {
      type: Schema.Types.ObjectId,
      ref: 'Auction',
      required: true,
      index: true,
    },
    bidderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [1, 'Bid amount must be positive'],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

bidSchema.index({ auctionId: 1, amount: -1 });
bidSchema.index({ auctionId: 1, createdAt: -1 });
bidSchema.index({ bidderId: 1, createdAt: -1 });

export const Bid = mongoose.model<IBid>('Bid', bidSchema);
