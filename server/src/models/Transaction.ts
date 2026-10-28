import mongoose, { Document, Schema } from 'mongoose';

export type TransactionStatus =
  | 'awaiting_handover'
  | 'handover_scheduled'
  | 'completed'
  | 'failed'
  | 'reassigned';

export interface ITransaction extends Document {
  auctionId: mongoose.Types.ObjectId;
  sellerId: mongoose.Types.ObjectId;
  buyerId: mongoose.Types.ObjectId;
  amount: number;
  status: TransactionStatus;
  handoverLocation?: string;
  handoverDateTime?: Date;
  handoverNotes?: string;
  sellerConfirmedAt?: Date | null;
  buyerConfirmedAt?: Date | null;
  reservationDeadline: Date;
  pickupDeadline?: Date;
  failureReason?: string;
  attemptNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    auctionId: {
      type: Schema.Types.ObjectId,
      ref: 'Auction',
      required: true,
      index: true,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    buyerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['awaiting_handover', 'handover_scheduled', 'completed', 'failed', 'reassigned'],
      default: 'awaiting_handover',
      index: true,
    },
    handoverLocation: {
      type: String,
      trim: true,
      default: '',
    },
    handoverDateTime: {
      type: Date,
    },
    handoverNotes: {
      type: String,
      trim: true,
      default: '',
    },
    sellerConfirmedAt: {
      type: Date,
      default: null,
    },
    buyerConfirmedAt: {
      type: Date,
      default: null,
    },
    reservationDeadline: {
      type: Date,
      required: true,
    },
    pickupDeadline: {
      type: Date,
    },
    failureReason: {
      type: String,
      default: '',
    },
    attemptNumber: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

transactionSchema.index({ sellerId: 1, createdAt: -1 });
transactionSchema.index({ buyerId: 1, createdAt: -1 });
transactionSchema.index({ auctionId: 1, status: 1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
