import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  fullName: string;
  email: string;
  passwordHash: string;
  department?: string;
  year?: number;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [60, 'Full name cannot exceed 60 characters'],
    },
    email: {
      type: String,
      required: [true, 'Kongu email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (value: string) {
          return /^[a-zA-Z0-9._%+-]+@kongu\.edu$/.test(value);
        },
        message: 'Registration is restricted strictly to @kongu.edu email addresses',
      },
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
    },
    department: {
      type: String,
      trim: true,
      default: '',
    },
    year: {
      type: Number,
      min: 1,
      max: 5,
    },
  },
  {
    timestamps: true,
  }
);

// Method to return safe JSON profile
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

export const User = mongoose.model<IUser>('User', userSchema);
