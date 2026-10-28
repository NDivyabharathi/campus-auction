import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ENV } from './config/env.js';

let io: SocketIOServer | null = null;

// Helper to extract JWT token from cookies or handshake auth
const extractToken = (socket: Socket): string | null => {
  // 1. Check handshake auth object
  if (socket.handshake.auth && socket.handshake.auth.token) {
    const t = socket.handshake.auth.token;
    return t.startsWith('Bearer ') ? t.slice(7) : t;
  }

  // 2. Check authorization header
  const authHeader = socket.handshake.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  // 3. Check cookies
  const cookieHeader = socket.handshake.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }

  return null;
};

export const initSocket = (server: HttpServer): SocketIOServer => {
  io = new SocketIOServer(server, {
    cors: {
      origin: [ENV.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    // 1. Authenticate user connection if token is available
    const token = extractToken(socket);
    if (token) {
      try {
        const decoded = jwt.verify(token, ENV.JWT_SECRET) as { id: string };
        if (decoded && decoded.id) {
          socket.data.userId = decoded.id;
          socket.join(`user:${decoded.id}`);
        }
      } catch (err) {
        // invalid token on handshake, guest connection
      }
    }

    // Explicit authenticate event if client attaches token after handshake
    socket.on('authenticate', (clientToken: string) => {
      if (!clientToken) return;
      try {
        const clean = clientToken.startsWith('Bearer ') ? clientToken.slice(7) : clientToken;
        const decoded = jwt.verify(clean, ENV.JWT_SECRET) as { id: string };
        if (decoded && decoded.id) {
          socket.data.userId = decoded.id;
          socket.join(`user:${decoded.id}`);
        }
      } catch (err) {
        // invalid token ignored
      }
    });

    // Public / Auction rooms
    socket.on('join_auction', (auctionId: string) => {
      if (auctionId) {
        socket.join(`auction:${auctionId}`);
      }
    });

    socket.on('leave_auction', (auctionId: string) => {
      if (auctionId) {
        socket.leave(`auction:${auctionId}`);
      }
    });
  });

  return io;
};

export const getIO = (): SocketIOServer | null => {
  return io;
};

export const broadcastAuctionUpdate = (auctionId: string, event: string, data: any) => {
  if (io) {
    io.to(`auction:${auctionId}`).emit(event, data);
    // Also emit globally for marketplace card updates
    io.emit('marketplace_update', { auctionId, event, data });
  }
};

/**
 * Deliver a notification directly to the authenticated user's private socket room
 */
export const sendNotificationToUser = (
  userId: string,
  notification: any,
  unreadCount?: number
) => {
  if (io && userId) {
    const room = `user:${userId}`;
    io.to(room).emit('notification:new', notification);
    if (typeof unreadCount === 'number') {
      io.to(room).emit('notification:unread_count', { count: unreadCount });
    }
  }
};

/**
 * Update unread count for a user across all their open tabs
 */
export const sendUnreadCountToUser = (userId: string, count: number) => {
  if (io && userId) {
    io.to(`user:${userId}`).emit('notification:unread_count', { count });
  }
};
