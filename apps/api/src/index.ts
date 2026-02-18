import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { rateLimit } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';
import { logger } from './config/logger.js';
import env from './config/env.js';
import authRoutes from './routes/v1/authRoutes.js';
import orgRoutes from './routes/v1/orgRoutes.js';
import userRoutes from './routes/v1/userRoutes.js';
import employeeProfileRoutes from './routes/v1/employeeProfileRoutes.js';
import departmentRoutes from './routes/v1/departmentRoutes.js';
import locationRoutes from './routes/v1/locationRoutes.js';
import shiftRoutes from './routes/v1/shiftRoutes.js';
import scheduleRoutes from './routes/v1/scheduleRoutes.js';
import timeOffRoutes from './routes/v1/timeOffRoutes.js';
import shiftSwapRoutes from './routes/v1/shiftSwapRoutes.js';
import analyticsRoutes from './routes/v1/analyticsRoutes.js';
import notificationRoutes from './routes/v1/notificationRoutes.js';
import setupRoutes from './routes/v1/setupRoutes.js';
import timeClockRoutes from './routes/v1/timeClockRoutes.js';

dotenv.config();

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGINS.split(','),
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit(env.RATE_LIMIT_WINDOW, env.RATE_LIMIT_MAX));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/org', authMiddleware, orgRoutes);
app.use('/api/v1/users', authMiddleware, userRoutes);
app.use('/api/v1/employee-profiles', authMiddleware, employeeProfileRoutes);
app.use('/api/v1/departments', authMiddleware, departmentRoutes);
app.use('/api/v1/locations', authMiddleware, locationRoutes);
app.use('/api/v1/shifts', authMiddleware, shiftRoutes);
app.use('/api/v1/schedules', authMiddleware, scheduleRoutes);
app.use('/api/v1/time-off', authMiddleware, timeOffRoutes);
app.use('/api/v1/shift-swaps', authMiddleware, shiftSwapRoutes);
app.use('/api/v1/analytics', authMiddleware, analyticsRoutes);
app.use('/api/v1/notifications', authMiddleware, notificationRoutes);
app.use('/api/v1/setup', authMiddleware, setupRoutes);
app.use('/api/v1/time-clock', authMiddleware, timeClockRoutes);

app.use(errorHandler);

export default app;
