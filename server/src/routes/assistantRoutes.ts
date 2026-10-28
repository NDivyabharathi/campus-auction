import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { handleAssistantChat } from '../controllers/assistantController.js';

const router = Router();

// Protected chat endpoint
router.post('/chat', authenticate, handleAssistantChat);

export default router;
