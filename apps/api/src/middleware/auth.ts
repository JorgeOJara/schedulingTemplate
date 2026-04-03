import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';
import { verifyAccessToken } from '../utils/authTokens.js';

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
    const payload = verifyAccessToken(token);

    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    req.user = {
      id: payload.userId,
      orgId: payload.orgId,
      role: payload.role,
    };

    next();
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
