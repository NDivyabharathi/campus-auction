import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { getGridFSBucket } from '../config/db.js';
import { Readable } from 'stream';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export const uploadImages = async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No image files provided for upload.',
      });
      return;
    }

    if (files.length > 5) {
      res.status(400).json({
        success: false,
        message: 'Maximum 5 images allowed per upload.',
      });
      return;
    }

    const bucket = getGridFSBucket();
    const uploadedUrls: string[] = [];

    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        res.status(400).json({
          success: false,
          message: `Unsupported file type: ${file.mimetype}. Allowed types: JPEG, PNG, WebP.`,
        });
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        res.status(400).json({
          success: false,
          message: `File ${file.originalname} exceeds 5MB size limit.`,
        });
        return;
      }

      // Upload to GridFS
      const readableStream = new Readable();
      readableStream.push(file.buffer);
      readableStream.push(null);

      const filename = `campus_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const uploadStream = bucket.openUploadStream(filename, {
        contentType: file.mimetype,
        metadata: {
          originalName: file.originalname,
          size: file.size,
          uploadedAt: new Date(),
        },
      });

      await new Promise<void>((resolve, reject) => {
        readableStream
          .pipe(uploadStream)
          .on('error', reject)
          .on('finish', () => {
            uploadedUrls.push(`/api/images/${uploadStream.id.toString()}`);
            resolve();
          });
      });
    }

    res.status(200).json({
      success: true,
      message: `${uploadedUrls.length} image(s) uploaded successfully.`,
      urls: uploadedUrls,
    });
  } catch (error: any) {
    console.error('[Image Upload Error]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error uploading image to MongoDB GridFS.',
    });
  }
};

export const getImageById = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid image ID format.',
      });
      return;
    }

    const bucket = getGridFSBucket();
    const _id = new mongoose.Types.ObjectId(id);

    const files = await bucket.find({ _id }).toArray();
    if (!files || files.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Image not found in database.',
      });
      return;
    }

    const file = files[0];
    res.setHeader('Content-Type', file.contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day browser cache

    const downloadStream = bucket.openDownloadStream(_id);
    downloadStream.on('error', () => {
      res.status(404).end();
    });
    downloadStream.pipe(res);
  } catch (error: any) {
    console.error('[Get Image Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve image.',
    });
  }
};
