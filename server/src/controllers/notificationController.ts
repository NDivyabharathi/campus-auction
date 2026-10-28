import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import {
  getUserNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../services/notificationService.js';

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const { page, limit, unreadOnly } = req.query;
    const result = await getUserNotifications(req.user._id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      unreadOnly: unreadOnly === 'true',
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[Get Notifications Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve notifications.',
    });
  }
};

export const getUnreadNotificationCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const unreadCount = await getUnreadCount(req.user._id);
    res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error: any) {
    console.error('[Get Unread Count Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to count unread notifications.',
    });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id) {
      res.status(400).json({ success: false, message: 'Notification ID required.' });
      return;
    }

    const updated = await markNotificationAsRead(id, req.user._id);
    if (!updated) {
      res.status(404).json({
        success: false,
        message: 'Notification not found or access denied.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
      notification: updated,
    });
  } catch (error: any) {
    console.error('[Mark Read Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read.',
    });
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const modifiedCount = await markAllNotificationsAsRead(req.user._id);
    res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
      modifiedCount,
    });
  } catch (error: any) {
    console.error('[Mark All Read Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read.',
    });
  }
};

export const dismissNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id) {
      res.status(400).json({ success: false, message: 'Notification ID required.' });
      return;
    }

    const deleted = await deleteNotification(id, req.user._id);
    if (!deleted) {
      res.status(404).json({
        success: false,
        message: 'Notification not found or access denied.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Notification dismissed successfully.',
    });
  } catch (error: any) {
    console.error('[Dismiss Notification Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to dismiss notification.',
    });
  }
};
