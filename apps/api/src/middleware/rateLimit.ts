import { Request, Response, NextFunction } from 'express';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  keyGenerator?: (req: Request) => string;
}

const defaultKeyGenerator = (req: Request): string => {
  return req.ip || req.socket.remoteAddress || 'unknown';
};

const cleanUpExpiredEntries = (now: number): void => {
  if (rateLimitMap.size < 5000) {
    return;
  }

  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
};

export const rateLimit = ({
  windowMs = 15 * 60 * 1000,
  maxRequests = 100,
  keyGenerator = defaultKeyGenerator,
}: RateLimitOptions = {}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (maxRequests <= 0) {
      next();
      return;
    }

    const key = keyGenerator(req);
    const now = Date.now();
    cleanUpExpiredEntries(now);

    let clientData = rateLimitMap.get(key);

    if (!clientData || now > clientData.resetTime) {
      clientData = { count: 1, resetTime: now + windowMs };
      rateLimitMap.set(key, clientData);
    } else {
      clientData.count++;
    }

    const remaining = Math.max(0, maxRequests - clientData.count);

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(clientData.resetTime / 1000)));

    if (clientData.count > maxRequests) {
      const retryAfter = Math.ceil((clientData.resetTime - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        error: 'Too many requests',
        retryAfter,
      });
      return;
    }

    next();
  };
};
