import { Router } from 'express';
import { AuthService } from '../../services/authService.js';
import { authMiddleware, rbacMiddleware } from '../../middleware/auth.js';
import env from '../../config/env.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { clearRefreshTokenCookie, getRefreshTokenFromRequest, setNoStoreHeaders, setRefreshTokenCookie, } from '../../utils/authCookies.js';
import { logger } from '../../config/logger.js';
const router = Router();
const publicAuthRateLimit = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW,
    maxRequests: env.AUTH_RATE_LIMIT_MAX,
    keyGenerator: (req) => {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const email = typeof req.body?.email === 'string'
            ? req.body.email.trim().toLowerCase()
            : 'anonymous';
        return `${ip}:${email}`;
    },
});
const sendSessionResponse = (res, result, statusCode = 200) => {
    setNoStoreHeaders(res);
    setRefreshTokenCookie(res, result.tokens.refreshToken);
    res.status(statusCode).json({
        user: result.user,
        accessToken: result.tokens.accessToken,
    });
};
// POST /api/v1/auth/login
router.post('/login', publicAuthRateLimit, async (req, res) => {
    try {
        const result = await AuthService.login(req.body);
        if (!result) {
            return res.status(401).json({ error: 'Invalid credentials or account pending approval' });
        }
        sendSessionResponse(res, result);
    }
    catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/v1/auth/register
router.post('/register', authMiddleware, rbacMiddleware(['ADMIN']), async (req, res) => {
    try {
        const requestedRole = req.body?.role;
        if (requestedRole === 'ADMIN' && req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Only admins can create admin users' });
        }
        const result = await AuthService.register({
            ...req.body,
            orgId: req.user.orgId,
        });
        if (!result) {
            return res.status(409).json({ error: 'User already exists' });
        }
        res.status(201).json({
            user: result.user,
        });
    }
    catch (error) {
        logger.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/v1/auth/register-owner
router.post('/register-owner', publicAuthRateLimit, async (req, res) => {
    try {
        const result = await AuthService.registerOwner(req.body);
        if (!result) {
            return res.status(409).json({ error: 'Owner email or organization name already exists' });
        }
        sendSessionResponse(res, result, 201);
    }
    catch (error) {
        logger.error('Owner registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/v1/auth/register-employee
router.post('/register-employee', publicAuthRateLimit, async (req, res) => {
    try {
        const result = await AuthService.registerEmployeeJoin(req.body);
        if (!result) {
            return res.status(404).json({ error: 'Organization not found or email already exists' });
        }
        res.status(201).json({
            message: 'Join request submitted. Wait for organization approval before logging in.',
            pendingUserId: result.pendingUserId,
            orgId: result.orgId,
        });
    }
    catch (error) {
        logger.error('Employee registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/auth/pending-employees
router.get('/pending-employees', authMiddleware, rbacMiddleware(['ADMIN', 'MANAGER']), async (req, res) => {
    try {
        const pendingEmployees = await AuthService.getPendingEmployees(req.user.orgId);
        res.status(200).json(pendingEmployees);
    }
    catch (error) {
        logger.error('Get pending employees error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// PATCH /api/v1/auth/pending-employees/:userId
router.patch('/pending-employees/:userId', authMiddleware, rbacMiddleware(['ADMIN', 'MANAGER']), async (req, res) => {
    try {
        const decision = req.body?.decision === 'REJECT' ? 'REJECT' : 'APPROVE';
        const result = await AuthService.reviewPendingEmployee(req.user.orgId, req.user.id, String(req.params.userId), decision);
        if (!result) {
            return res.status(404).json({ error: 'Pending employee not found' });
        }
        res.status(200).json(result);
    }
    catch (error) {
        logger.error('Review pending employee error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/v1/auth/invite
router.post('/invite', authMiddleware, rbacMiddleware(['ADMIN', 'MANAGER']), async (req, res) => {
    try {
        if (req.body?.role === 'ADMIN' && req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Only admins can invite admin users' });
        }
        const result = await AuthService.invite({
            ...req.body,
            orgId: req.user.orgId,
        });
        if (!result) {
            return res.status(409).json({ error: 'User already exists' });
        }
        res.status(201).json({ message: 'Invite sent', token: result.token });
    }
    catch (error) {
        logger.error('Invite error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/v1/auth/accept-invite
router.post('/accept-invite', publicAuthRateLimit, async (req, res) => {
    try {
        const { token, password } = req.body;
        const result = await AuthService.acceptInvite(token, password);
        if (!result) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }
        sendSessionResponse(res, result);
    }
    catch (error) {
        logger.error('Accept invite error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/v1/auth/forgot-password
router.post('/forgot-password', publicAuthRateLimit, async (req, res) => {
    try {
        const { email } = req.body;
        const result = await AuthService.forgotPassword(email);
        if (!result) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ message: 'Password reset email sent' });
    }
    catch (error) {
        logger.error('Forgot password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/v1/auth/reset-password
router.post('/reset-password', publicAuthRateLimit, async (req, res) => {
    try {
        const { token, password } = req.body;
        const result = await AuthService.resetPassword(token, password);
        if (!result) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }
        res.status(200).json({ message: 'Password reset successful' });
    }
    catch (error) {
        logger.error('Reset password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/v1/auth/refresh
router.post('/refresh', publicAuthRateLimit, async (req, res) => {
    try {
        const refreshToken = getRefreshTokenFromRequest(req);
        if (!refreshToken) {
            clearRefreshTokenCookie(res);
            return res.status(401).json({ error: 'Refresh session missing' });
        }
        const result = await AuthService.refreshTokens(refreshToken);
        if (!result) {
            clearRefreshTokenCookie(res);
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }
        sendSessionResponse(res, result);
    }
    catch (error) {
        logger.error('Refresh token error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/v1/auth/logout
router.post('/logout', authMiddleware, async (req, res) => {
    try {
        await AuthService.logout(req.user.id);
        clearRefreshTokenCookie(res);
        setNoStoreHeaders(res);
        res.status(200).json({ message: 'Logged out' });
    }
    catch (error) {
        logger.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
export default router;
