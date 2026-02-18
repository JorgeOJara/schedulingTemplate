import { Router } from 'express';
import { EmployeeProfileService } from '../../services/employeeProfileService.js';
import { AuthRequest } from '../../middleware/auth.js';

const router = Router();

// GET /api/v1/employee-profiles/me
router.get('/me', async (req: AuthRequest, res) => {
  try {
    const profile = await EmployeeProfileService.getProfileByUserId(req.user!.id);
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.status(200).json(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/employee-profiles/me
router.post('/me', async (req: AuthRequest, res) => {
  try {
    const profile = await EmployeeProfileService.upsertProfile(req.user!.id, req.body);
    
    res.status(201).json(profile);
  } catch (error) {
    console.error('Create profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/employee-profiles/:id
router.put('/:id', async (req, res) => {
  try {
    const profile = await EmployeeProfileService.updateProfile(req.params.id, req.body);
    
    res.status(200).json(profile);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
