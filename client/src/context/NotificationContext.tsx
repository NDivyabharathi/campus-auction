import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext.js';
import { api } from '../services/api.js';
import type { AppNotification } from '../types/index.js';

type BrowserPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  browserPermission: BrowserPermissionState;
  requestBrowserPermission: () => Promise<boolean>;
  fetchNotifications: (options?: { page?: number; limit?: number; unreadOnly?: boolean }) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Channel for cross-tab deduplication of browser notification display
const channel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('campus_auction_notifications')
  : null;

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [browserPermission, setBrowserPermission] = useState<BrowserPermissionState>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission as BrowserPermissionState;
  });

  const socketRef = useRef<Socket | null>(null);
  const recentNotificationIds = useRef<Set<string>>(new Set());

  // Listen to broadcast channel to avoid duplicate browser popups across open tabs
  useEffect(() => {
    if (!channel) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BROWSER_NOTIFICATION_SHOWN' && event.data?.id) {
        recentNotificationIds.current.add(event.data.id);
      }
    };
    channel.addEventListener('message', handleMessage);
    return () => channel.removeEventListener('message', handleMessage);
  }, []);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await api.get('/notifications/unread-count');
      if (res.data.success && typeof res.data.unreadCount === 'number') {
        setUnreadCount(res.data.unreadCount);
      }
    } catch {
      // Ignore network errors on background poll
    }
  }, [user]);

  // Fetch notification list
  const fetchNotifications = useCallback(
    async (options: { page?: number; limit?: number; unreadOnly?: boolean } = {}) => {
      if (!user) {
        setNotifications([]);
        return;
      }
      try {
        setLoading(true);
        const res = await api.get('/notifications', { params: options });
        if (res.data.success && Array.isArray(res.data.notifications)) {
          setNotifications(res.data.notifications);
          if (typeof res.data.unreadCount === 'number') {
            setUnreadCount(res.data.unreadCount);
          }
        }
      } catch (err) {
        console.error('[Notification Context] Failed to fetch notifications:', err);
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  // Mark single notification as read
  const markAsRead = async (id: string) => {
    try {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      await api.patch(`/notifications/${id}/read`);
    } catch (err) {
      console.error('[Notification Context] Failed to mark read:', err);
      fetchUnreadCount();
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
      setUnreadCount(0);

      await api.patch('/notifications/read-all');
    } catch (err) {
      console.error('[Notification Context] Failed to mark all read:', err);
      fetchUnreadCount();
    }
  };

  // Dismiss notification
  const dismissNotification = async (id: string) => {
    try {
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      await api.delete(`/notifications/${id}`);
      fetchUnreadCount();
    } catch (err) {
      console.error('[Notification Context] Failed to dismiss notification:', err);
    }
  };

  // Request browser notification permission
  const requestBrowserPermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserPermission('unsupported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      const state = permission as BrowserPermissionState;
      setBrowserPermission(state);
      return state === 'granted';
    } catch (err) {
      console.error('[Notification Context] Permission request error:', err);
      return false;
    }
  };

  // Display browser notification with multi-tab deduplication
  const showBrowserNotification = useCallback((notification: AppNotification) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const notifId = notification._id;
    if (recentNotificationIds.current.has(notifId)) return;

    recentNotificationIds.current.add(notifId);

    // Notify other tabs that this notification has been displayed
    if (channel) {
      channel.postMessage({ type: 'BROWSER_NOTIFICATION_SHOWN', id: notifId });
    }

    try {
      const browserNotif = new Notification(`Campus Auction: ${notification.title}`, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: `campus_auction_${notifId}`, // Replaces older alert for same event
      });

      browserNotif.onclick = () => {
        window.focus();
        browserNotif.close();

        // Navigate to related auction or transaction
        if (notification.transactionId) {
          window.location.href = '/transactions';
        } else if (notification.auctionId) {
          const aucId = typeof notification.auctionId === 'string'
            ? notification.auctionId
            : notification.auctionId._id;
          window.location.href = `/auctions/${aucId}`;
        }
      };
    } catch (err) {
      console.warn('[Notification Context] Failed to spawn browser notification:', err);
    }
  }, []);

  // Socket.IO Setup for real-time notification delivery
  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    // Load initial data
    fetchUnreadCount();
    fetchNotifications({ limit: 15 });

    const token = localStorage.getItem('campus_token');
    const socket = io(window.location.origin, {
      withCredentials: true,
      auth: { token: token ? `Bearer ${token}` : undefined },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      if (token) {
        socket.emit('authenticate', token);
      }
    });

    // Real-time notification received
    socket.on('notification:new', (newNotification: AppNotification) => {
      setNotifications((prev) => [newNotification, ...prev.filter((n) => n._id !== newNotification._id)]);
      setUnreadCount((prev) => prev + 1);

      // Trigger browser notification if permitted
      showBrowserNotification(newNotification);
    });

    // Real-time unread count sync
    socket.on('notification:unread_count', (data: { count: number }) => {
      if (typeof data.count === 'number') {
        setUnreadCount(data.count);
      }
    });

    // Reconnect handler: resync state with server
    socket.on('reconnect', () => {
      fetchUnreadCount();
      fetchNotifications({ limit: 15 });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, fetchUnreadCount, fetchNotifications, showBrowserNotification]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        browserPermission,
        requestBrowserPermission,
        fetchNotifications,
        fetchUnreadCount,
        markAsRead,
        markAllAsRead,
        dismissNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
