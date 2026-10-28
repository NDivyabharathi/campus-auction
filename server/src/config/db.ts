import mongoose from 'mongoose';
import { ENV } from './env.js';

let gridFSBucket: mongoose.mongo.GridFSBucket | null = null;

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(ENV.MONGODB_URI);
    console.log(`[Database] MongoDB connected successfully to ${mongoose.connection.host}/${mongoose.connection.name}`);
    
    if (mongoose.connection.db) {
      gridFSBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads',
      });
      console.log('[Database] GridFS Bucket initialized for images');
    }
  } catch (error) {
    console.error('[Database Error] Failed to connect to MongoDB:', error);
    process.exit(1);
  }
};

export const getGridFSBucket = (): mongoose.mongo.GridFSBucket => {
  if (!gridFSBucket) {
    if (mongoose.connection.db) {
      gridFSBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads',
      });
      return gridFSBucket;
    }
    throw new Error('GridFS Bucket is not initialized. Database not connected.');
  }
  return gridFSBucket;
};
