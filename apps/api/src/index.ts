import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';
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
import employeeGroupRoutes from './routes/v1/employeeGroupRoutes.js';

const app = express();
const allowedCorsOrigins = env.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedCorsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  })
);
app.use(express.json({ limit: env.BODY_SIZE_LIMIT, strict: true }));
app.use(express.urlencoded({ extended: true, limit: env.BODY_SIZE_LIMIT }));
app.use(rateLimit({ windowMs: env.RATE_LIMIT_WINDOW, maxRequests: env.RATE_LIMIT_MAX }));

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
app.use('/api/v1/employee-groups', authMiddleware, employeeGroupRoutes);

app.use(errorHandler);

export default app;
