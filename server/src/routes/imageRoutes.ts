import { Router } from 'express';
import multer from 'multer';
import { uploadImages, getImageById } from '../controllers/imageController.js';
import { authenticate } from '../middleware/auth.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5,
  },
});

const router = Router();

// Upload image (requires authenticated Kongu student)
router.post('/upload', authenticate, upload.array('images', 5), uploadImages);

// Stream image (publicly accessible)
router.get('/:id', getImageById);

export default router;
