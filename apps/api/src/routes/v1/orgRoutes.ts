import { Router } from 'express';
import { OrgService } from '../../services/orgService.js';
import { AuthRequest } from '../../middleware/auth.js';
import { orgOwnershipMiddleware, rbacMiddleware } from '../../middleware/auth.js';

const router = Router();

// GET /api/v1/organizations/me
router.get('/me', async (req: AuthRequest, res) => {
  try {
    const org = await OrgService.getOrg(req.user!.orgId);
    
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.status(200).json(org);
  } catch (error) {
    console.error('Get org error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/organizations/me
router.put('/me', async (req: AuthRequest, res) => {
  try {
    const org = await OrgService.updateOrg(req.user!.orgId, req.body);
    
    res.status(200).json(org);
  } catch (error) {
    console.error('Update org error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/org/me/employees
router.get('/me/employees', rbacMiddleware(['ADMIN', 'MANAGER']), async (req: AuthRequest, res) => {
  try {
    const employees = await OrgService.getEmployees(req.user!.orgId);
    res.status(200).json(employees);
  } catch (error) {
    console.error('Get my org employees error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/organizations/:orgId/employees
router.get('/:orgId/employees', orgOwnershipMiddleware, rbacMiddleware(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const employees = await OrgService.getEmployees(String(req.params.orgId));
    
    res.status(200).json(employees);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
