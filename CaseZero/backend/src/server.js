import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import app, { getAllowedOrigins } from './app.js';
import { initSocket } from './socket.js';
import { connectDB } from './db.js';

const port = parseInt(process.env.PORT, 10) || 5000;
const host = '0.0.0.0';

const server = http.createServer(app);
initSocket(server);

// Start HTTP & Socket server
server.listen(port, host, () => {
  console.log(`[Server] CaseZero API & Socket server running on http://${host}:${port}`);
  console.log(`[Server] Allowed CORS origins:`, getAllowedOrigins());
});

// Connect to MongoDB
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error('[Server] CRITICAL: MONGO_URI is not set in environment variables.');
} else {
  connectDB(mongoUri).catch((err) => {
    console.error('[Server] Unexpected error during MongoDB startup:', err?.message || err);
  });
}

// Graceful Shutdown
let isShuttingDown = false;
const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);

  server.close(async () => {
    console.log('[Server] HTTP server stopped accepting connections.');
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close(false);
        console.log('[Database] MongoDB connection closed.');
      }
    } catch (err) {
      console.error('[Database] Error closing MongoDB connection:', err.message);
    }
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[Server] Could not close connections in time, forcefully shutting down.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
