import { Request, Response, NextFunction } from 'express';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = (windowMs = 15 * 60 * 1000, maxRequests = 100) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (process.env.NODE_ENV !== 'production') {
      next();
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    
    let clientData = rateLimitMap.get(ip);
    
    if (!clientData || now > clientData.resetTime) {
      clientData = { count: 1, resetTime: now + windowMs };
      rateLimitMap.set(ip, clientData);
    } else {
      clientData.count++;
    }
    
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - clientData.count)));
    
    if (clientData.count > maxRequests) {
      res.status(429).json({ 
        error: 'Too many requests', 
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000) 
      });
      return;
    }
    
    next();
  };
};
