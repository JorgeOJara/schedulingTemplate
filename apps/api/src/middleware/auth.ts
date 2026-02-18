import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger.js';

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  user?: {
    id: string;
    orgId: string;
    role: string;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const token = authHeader.substring(7);
    
    jwt.verify(token, process.env.JWT_SECRET!, (err, decoded) => {
      if (err) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }

      const payload = decoded as { userId: string; orgId: string; role: string };
      req.user = {
        id: payload.userId,
        orgId: payload.orgId,
        role: payload.role,
      };
      next();
    });
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication required' });
  }
};

export const rbacMiddleware = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
};

export const orgOwnershipMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { orgId } = req.params;
    
    if (orgId) {
      if (req.user.orgId !== orgId) {
        res.status(403).json({ error: 'Access denied to this organization' });
        return;
      }
    }
    
    next();
  } catch (error) {
    logger.error('Org ownership middleware error:', error);
    res.status(403).json({ error: 'Access denied' });
  }
};
