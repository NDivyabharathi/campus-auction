import mongoose from 'mongoose';
import { Notification, INotification, NotificationType } from '../models/Notification.js';
import { sendNotificationToUser, sendUnreadCountToUser } from '../socket.js';

export interface CreateNotificationInput {
  recipientId: string | mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  auctionId?: string | mongoose.Types.ObjectId;
  transactionId?: string | mongoose.Types.ObjectId;
  actorId?: string | mongoose.Types.ObjectId;
  deduplicationKey?: string;
  metadata?: Record<string, any>;
}

export const createNotification = async (
  input: CreateNotificationInput
): Promise<INotification | null> => {
  try {
    const {
      recipientId,
      type,
      title,
      message,
      auctionId,
      transactionId,
      actorId,
      deduplicationKey,
      metadata = {},
    } = input;

    if (!recipientId) {
      console.warn('[Notification Service] Cannot create notification without recipientId.');
      return null;
    }

    // 1. Deduplication check if key is provided
    if (deduplicationKey) {
      const existing = await Notification.findOne({ deduplicationKey });
      if (existing) {
        // Notification already sent for this distinct key, skip silently
        return existing;
      }
    }

    // 2. Persist in MongoDB
    const notification = await Notification.create({
      recipientId: new mongoose.Types.ObjectId(recipientId.toString()),
      type,
      title: title.trim(),
      message: message.trim(),
      auctionId: auctionId ? new mongoose.Types.ObjectId(auctionId.toString()) : null,
      transactionId: transactionId ? new mongoose.Types.ObjectId(transactionId.toString()) : null,
      actorId: actorId ? new mongoose.Types.ObjectId(actorId.toString()) : null,
      deduplicationKey: deduplicationKey || null,
      metadata,
    });

    // Populate references for socket client delivery
    const populated = await Notification.findById(notification._id)
      .populate('auctionId', 'title startingPrice currentLeadingBid status imageUrls')
      .populate('actorId', 'fullName department')
      .lean();

    // 3. Compute new unread count
    const unreadCount = await Notification.countDocuments({
      recipientId: notification.recipientId,
      readAt: null,
    });

    // 4. Real-time delivery via Socket.IO
    try {
      sendNotificationToUser(notification.recipientId.toString(), populated || notification, unreadCount);
    } catch (socketErr) {
      // Socket delivery failure must never rollback or fail persisted notification
      console.error('[Notification Service] Socket.IO delivery failed:', socketErr);
    }

    return notification;
  } catch (error: any) {
    // Handle duplicate key error gracefully if concurrent worker race happened
    if (error.code === 11000 && input.deduplicationKey) {
      const existing = await Notification.findOne({ deduplicationKey: input.deduplicationKey });
      return existing;
    }

    console.error('[Notification Service Error] Failed to create notification:', error);
    return null;
  }
};

export const getUnreadCount = async (userId: string | mongoose.Types.ObjectId): Promise<number> => {
  return Notification.countDocuments({
    recipientId: new mongoose.Types.ObjectId(userId.toString()),
    readAt: null,
  });
};

export const getUserNotifications = async (
  userId: string | mongoose.Types.ObjectId,
  options: { page?: number; limit?: number; unreadOnly?: boolean } = {}
) => {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(options.limit) || 20));
  const skip = (page - 1) * limit;

  const query: any = {
    recipientId: new mongoose.Types.ObjectId(userId.toString()),
  };

  if (options.unreadOnly) {
    query.readAt = null;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .populate('auctionId', 'title startingPrice currentLeadingBid status imageUrls')
      .populate('actorId', 'fullName department')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({
      recipientId: new mongoose.Types.ObjectId(userId.toString()),
      readAt: null,
    }),
  ]);

  return {
    notifications,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    unreadCount,
  };
};

export const markNotificationAsRead = async (
  notificationId: string,
  userId: string | mongoose.Types.ObjectId
): Promise<INotification | null> => {
  if (!mongoose.Types.ObjectId.isValid(notificationId)) return null;

  const notification = await Notification.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(notificationId),
      recipientId: new mongoose.Types.ObjectId(userId.toString()),
    },
    { $set: { readAt: new Date() } },
    { new: true }
  );

  if (notification) {
    const unreadCount = await getUnreadCount(userId);
    sendUnreadCountToUser(userId.toString(), unreadCount);
  }

  return notification;
};

export const markAllNotificationsAsRead = async (
  userId: string | mongoose.Types.ObjectId
): Promise<number> => {
  const result = await Notification.updateMany(
    {
      recipientId: new mongoose.Types.ObjectId(userId.toString()),
      readAt: null,
    },
    { $set: { readAt: new Date() } }
  );

  sendUnreadCountToUser(userId.toString(), 0);
  return result.modifiedCount;
};

export const deleteNotification = async (
  notificationId: string,
  userId: string | mongoose.Types.ObjectId
): Promise<boolean> => {
  if (!mongoose.Types.ObjectId.isValid(notificationId)) return false;

  const result = await Notification.deleteOne({
    _id: new mongoose.Types.ObjectId(notificationId),
    recipientId: new mongoose.Types.ObjectId(userId.toString()),
  });

  if (result.deletedCount > 0) {
    const unreadCount = await getUnreadCount(userId);
    sendUnreadCountToUser(userId.toString(), unreadCount);
    return true;
  }

  return false;
};

