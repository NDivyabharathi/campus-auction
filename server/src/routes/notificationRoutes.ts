import { Router } from 'express';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAsRead,
  markAllAsRead,
  dismissNotification,
} from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All notification routes are strictly protected
router.use(authenticate);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadNotificationCount);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.delete('/:id', dismissNotification);

export default router;
