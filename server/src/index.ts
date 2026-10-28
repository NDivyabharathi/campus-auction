import http from 'http';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { ENV } from './config/env.js';
import { initSocket } from './socket.js';
import { startAuctionClosureWorker } from './services/auctionClosureService.js';

const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Initialize Express application
    const app = createApp();
    const server = http.createServer(app);

    // 3. Initialize Socket.IO
    initSocket(server);

    // 4. Start background auction closure worker
    startAuctionClosureWorker(10000);

    // 4. Listen on PORT
    const port = Number(ENV.PORT) || 5000;
    server.listen(port, () => {
      console.log(`[Server] Campus Auction backend running on http://localhost:${port}`);
      console.log(`[Server] CORS configured for frontend at: ${ENV.CLIENT_URL}`);
      console.log(`[Server] Environment: ${ENV.NODE_ENV}`);
    });
  } catch (error) {
    console.error('[Server Error] Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
