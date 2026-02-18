import { Router } from 'express';
import { UserService } from '../../services/userService.js';
import { AuthRequest } from '../../middleware/auth.js';

const router = Router();

// GET /api/v1/users/me
router.get('/me', async (req: AuthRequest, res) => {
  try {
    const user = await UserService.getUserById(req.user!.id);
    
    res.status(200).json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/users/peers
router.get('/peers', async (req: AuthRequest, res) => {
  try {
    const peers = await UserService.getPeersByRole(req.user!.orgId, req.user!.role, req.user!.id);
    res.status(200).json(peers);
  } catch (error) {
    console.error('Get peers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/users/me
router.put('/me', async (req: AuthRequest, res) => {
  try {
    const user = await UserService.updateUser(req.user!.id, req.body);
    
    res.status(200).json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/v1/users/me/deactivate
router.patch('/me/deactivate', async (req: AuthRequest, res) => {
  try {
    const user = await UserService.deactivateUser(req.user!.id);
    
    res.status(200).json(user);
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/v1/users/me/reactivate
router.patch('/me/reactivate', async (req: AuthRequest, res) => {
  try {
    const user = await UserService.reactivateUser(req.user!.id);
    
    res.status(200).json(user);
  } catch (error) {
    console.error('Reactivate user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/users/:userId/profile
router.get('/:userId/profile', async (req, res) => {
  try {
    const profile = await UserService.getProfile(req.params.userId);
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.status(200).json(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
