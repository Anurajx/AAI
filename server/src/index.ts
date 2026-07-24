import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/authRoutes';
import inventoryRoutes from './routes/inventoryRoutes';
import stockRoutes from './routes/stockRoutes';
import procurementRoutes from './routes/procurementRoutes';
import reportsRoutes from './routes/reportsRoutes';
import adminRoutes from './routes/adminRoutes';
import notificationRoutes from './routes/notificationRoutes';
import { initCronJobs } from './utils/cron';
import { prisma } from './db';

// Load environmental configuration
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded assets (mock or files)
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'AeroStock backend is operational.' });
});

// REST Routing - API V1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', inventoryRoutes);
app.use('/api/v1', stockRoutes);
app.use('/api/v1', procurementRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1', adminRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'An internal server error occurred.'
  });
});

// Initialize background stock auditing scheduler
initCronJobs();

async function startServer() {
  try {
    await prisma.$connect();
    console.log('[AeroStock Server] Database connected');
  } catch (err) {
    console.error('[AeroStock Server] Cannot connect to PostgreSQL at localhost:5432');
    console.error('[AeroStock Server] Start the database first: npm run db:up (from project root)');
    console.error('[AeroStock Server] Or ensure Docker Desktop / PostgreSQL is running, then run: npm run db:push');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`[AeroStock Server] Running on http://localhost:${PORT}`);
    console.log(`[AeroStock Server] API v1 base: http://localhost:${PORT}/api/v1`);
  });
}

startServer();
