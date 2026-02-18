import { Router } from 'express';
import { AuthService } from '../../services/authService.js';
import { AuthRequest, authMiddleware, rbacMiddleware } from '../../middleware/auth.js';

const router = Router();

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  try {
    const result = await AuthService.login(req.body);

    if (!result) {
      return res.status(401).json({ error: 'Invalid credentials or account pending approval' });
    }

    const { user, tokens } = result;

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        orgId: user.orgId,
      },
      tokens,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/register
router.post('/register', async (req, res) => {
  try {
    const result = await AuthService.register(req.body);

    if (!result) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const { user, tokens } = result;

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        orgId: user.orgId,
      },
      tokens,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/register-owner
router.post('/register-owner', async (req, res) => {
  try {
    const result = await AuthService.registerOwner(req.body);

    if (!result) {
      return res.status(409).json({ error: 'Owner email or organization name already exists' });
    }

    const { user, tokens } = result;

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        orgId: user.orgId,
      },
      tokens,
    });
  } catch (error) {
    console.error('Owner registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/register-employee
router.post('/register-employee', async (req, res) => {
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
  } catch (error) {
    console.error('Employee registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/auth/pending-employees
router.get(
  '/pending-employees',
  authMiddleware,
  rbacMiddleware(['ADMIN', 'MANAGER']),
  async (req: AuthRequest, res) => {
    try {
      const pendingEmployees = await AuthService.getPendingEmployees(req.user!.orgId);
      res.status(200).json(pendingEmployees);
    } catch (error) {
      console.error('Get pending employees error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PATCH /api/v1/auth/pending-employees/:userId
router.patch(
  '/pending-employees/:userId',
  authMiddleware,
  rbacMiddleware(['ADMIN', 'MANAGER']),
  async (req: AuthRequest, res) => {
    try {
      const decision = req.body?.decision === 'REJECT' ? 'REJECT' : 'APPROVE';
      const result = await AuthService.reviewPendingEmployee(
        req.user!.orgId,
        req.user!.id,
        req.params.userId,
        decision
      );

      if (!result) {
        return res.status(404).json({ error: 'Pending employee not found' });
      }

      res.status(200).json(result);
    } catch (error) {
      console.error('Review pending employee error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/v1/auth/invite
router.post('/invite', async (req, res) => {
  try {
    const result = await AuthService.invite(req.body);

    if (!result) {
      return res.status(409).json({ error: 'User already exists' });
    }

    res.status(201).json({ message: 'Invite sent', token: result.token });
  } catch (error) {
    console.error('Invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/accept-invite
router.post('/accept-invite', async (req, res) => {
  try {
    const { token, password } = req.body;
    const result = await AuthService.acceptInvite(token, password);

    if (!result) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const { user, tokens } = result;

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        orgId: user.orgId,
      },
      tokens,
    });
  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await AuthService.forgotPassword(email);

    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    const result = await AuthService.resetPassword(token, password);

    if (!result) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const result = await AuthService.refreshTokens(refreshToken);

    if (!result) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await AuthService.logout(req.user!.id);
    res.status(200).json({ message: 'Logged out' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
