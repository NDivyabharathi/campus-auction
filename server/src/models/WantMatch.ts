import mongoose, { Document, Schema } from 'mongoose';

export interface IWantMatch extends Document {
  want: mongoose.Types.ObjectId;
  listing: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  matchedAt: Date;
  notificationId?: mongoose.Types.ObjectId;
  matchReason: string;
  createdAt: Date;
  updatedAt: Date;
}

const wantMatchSchema = new Schema<IWantMatch>(
  {
    want: {
      type: Schema.Types.ObjectId,
      ref: 'Want',
      required: [true, 'Want reference is required'],
      index: true,
    },
    listing: {
      type: Schema.Types.ObjectId,
      ref: 'Auction',
      required: [true, 'Auction listing reference is required'],
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student owner reference is required'],
      index: true,
    },
    matchedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    notificationId: {
      type: Schema.Types.ObjectId,
      ref: 'Notification',
      required: false,
    },
    matchReason: {
      type: String,
      required: [true, 'Match reason is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Unique Index to strictly prevent duplicate alerts and matches
wantMatchSchema.index({ want: 1, listing: 1 }, { unique: true });
wantMatchSchema.index({ student: 1, matchedAt: -1 });

export const WantMatch = mongoose.model<IWantMatch>('WantMatch', wantMatchSchema);
