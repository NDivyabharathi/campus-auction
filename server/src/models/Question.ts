import mongoose, { Document, Schema } from 'mongoose';

export interface IAnswer {
  _id?: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IQuestion extends Document {
  auctionId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  text: string;
  answers: IAnswer[];
  createdAt: Date;
  updatedAt: Date;
}

const answerSchema = new Schema<IAnswer>(
  {
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Answer author is required'],
    },
    text: {
      type: String,
      required: [true, 'Answer text is required'],
      trim: true,
      minlength: [1, 'Answer cannot be empty'],
      maxlength: [1000, 'Answer cannot exceed 1000 characters'],
    },
  },
  { timestamps: true }
);

const questionSchema = new Schema<IQuestion>(
  {
    auctionId: {
      type: Schema.Types.ObjectId,
      ref: 'Auction',
      required: [true, 'Auction reference is required'],
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Question author is required'],
      index: true,
    },
    text: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
      minlength: [3, 'Question must be at least 3 characters'],
      maxlength: [500, 'Question cannot exceed 500 characters'],
    },
    answers: {
      type: [answerSchema],
      default: [],
    },
  },
  { timestamps: true }
);

questionSchema.index({ auctionId: 1, createdAt: -1 });

export const Question = mongoose.model<IQuestion>('Question', questionSchema);
