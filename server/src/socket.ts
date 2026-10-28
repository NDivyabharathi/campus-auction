import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { ENV } from './config/env.js';

let io: SocketIOServer | null = null;

export const initSocket = (server: HttpServer): SocketIOServer => {
  io = new SocketIOServer(server, {
    cors: {
      origin: [ENV.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    // Join room for specific auction
    socket.on('join_auction', (auctionId: string) => {
      socket.join(`auction:${auctionId}`);
    });

    // Leave room for specific auction
    socket.on('leave_auction', (auctionId: string) => {
      socket.leave(`auction:${auctionId}`);
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
