import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { logger } from '../config/logger.js';

export interface ErrorResponse {
  error: string;
  message?: string;
  details?: unknown;
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response<ErrorResponse>,
  next: NextFunction
): void => {
  logger.error('Error:', err);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        res.status(409).json({ 
          error: 'Conflict', 
          message: 'Unique constraint violated',
          details: err.meta 
        });
        return;
      case 'P2003':
        res.status(400).json({ 
          error: 'Validation', 
          message: 'Foreign key constraint failed' 
        });
        return;
      case 'P2025':
        res.status(404).json({ 
          error: 'Not Found', 
          message: 'Record not found' 
        });
        return;
      default:
        res.status(400).json({ error: 'Database error', details: err.meta });
        return;
    }
  }

  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({ error: 'Token expired' });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
};
