import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType =
  | 'bid_received'
  | 'outbid'
  | 'auction_won'
  | 'auction_lost'
  | 'auction_sold'
  | 'auction_unsold'
  | 'auction_ending_soon'
  | 'handover_scheduled'
  | 'handover_confirmed_by_peer'
  | 'transaction_completed'
  | 'transaction_failed'
  | 'handover_reassigned'
  | 'question_asked'
  | 'answer_received'
  | 'want_match'
  | 'want_fulfilled_suggestion'
  | 'system';

export interface INotification extends Document {
  recipientId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  auctionId?: mongoose.Types.ObjectId;
  transactionId?: mongoose.Types.ObjectId;
  actorId?: mongoose.Types.ObjectId;
  readAt?: Date | null;
  deduplicationKey?: string | null;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient ID is required'],
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Notification type is required'],
      enum: [
        'bid_received',
        'outbid',
        'auction_won',
        'auction_lost',
        'auction_sold',
        'auction_unsold',
        'auction_ending_soon',
        'handover_scheduled',
        'handover_confirmed_by_peer',
        'transaction_completed',
        'transaction_failed',
        'handover_reassigned',
        'question_asked',
        'answer_received',
        'want_match',
        'want_fulfilled_suggestion',
        'system',
      ],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    auctionId: {
      type: Schema.Types.ObjectId,
      ref: 'Auction',
      default: null,
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
      index: true,
    },
    deduplicationKey: {
      type: String,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for high-speed queries
notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });
// Unique sparse index to prevent duplicate alerts for deterministic keys
notificationSchema.index({ deduplicationKey: 1 }, { unique: true, sparse: true });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
