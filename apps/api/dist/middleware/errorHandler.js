import { ZodError } from 'zod';
import { logger } from '../config/logger.js';
const isPrismaKnownRequestError = (error) => {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const candidate = error;
    return (candidate.name === 'PrismaClientKnownRequestError' &&
        typeof candidate.code === 'string');
};
export const errorHandler = (err, _req, res, _next) => {
    logger.error('Error:', err);
    if (err instanceof ZodError) {
        res.status(400).json({
            error: 'Validation',
            message: 'Request validation failed',
            details: err.flatten(),
        });
        return;
    }
    if (isPrismaKnownRequestError(err)) {
        switch (err.code) {
            case 'P2002':
                res.status(409).json({
                    error: 'Conflict',
                    message: 'Unique constraint violated',
                });
                return;
            case 'P2003':
                res.status(400).json({
                    error: 'Validation',
                    message: 'Foreign key constraint failed',
                });
                return;
            case 'P2025':
                res.status(404).json({
                    error: 'Not Found',
                    message: 'Record not found',
                });
                return;
            default:
                res.status(400).json({ error: 'Database error' });
                return;
        }
    }
    if (err instanceof Error && err.name === 'JsonWebTokenError') {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }
    if (err instanceof Error && err.name === 'TokenExpiredError') {
        res.status(401).json({ error: 'Token expired' });
        return;
    }
    res.status(500).json({ error: 'Internal server error' });
};
