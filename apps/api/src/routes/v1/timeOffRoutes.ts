import { Router } from 'express';
import { TimeOffService } from '../../services/timeOffService.js';
import { AuthRequest } from '../../middleware/auth.js';

const router = Router();

// GET /api/v1/time-off/:id
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const request = await TimeOffService.getRequest(req.params.id, req.user!.orgId);
    
    if (!request) {
      return res.status(404).json({ error: 'Time-off request not found' });
    }

    res.status(200).json(request);
  } catch (error) {
    console.error('Get time-off request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/time-off
router.get('/', async (req: AuthRequest, res) => {
  try {
    const requests = await TimeOffService.getRequests(req.user!.orgId, {
      status: req.query.status as string,
      employeeId: req.query.employeeId as string,
    });
    
    res.status(200).json(requests);
  } catch (error) {
    console.error('Get time-off requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/time-off/my-requests
router.get('/my-requests', async (req: AuthRequest, res) => {
  try {
    const requests = await TimeOffService.getUserRequests(req.user!.id);
    
    res.status(200).json(requests);
  } catch (error) {
    console.error('Get my time-off requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/time-off
router.post('/', async (req: AuthRequest, res) => {
  try {
    const request = await TimeOffService.createRequest({
      orgId: req.user!.orgId,
      employeeId: req.body.employeeId || req.user!.id,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      type: req.body.type,
      reason: req.body.reason,
    });
    
    res.status(201).json(request);
  } catch (error) {
    console.error('Create time-off request error:', error);
    res.status(409).json({ error: error.message });
  }
});

// PUT /api/v1/time-off/:id/approve
router.put('/:id/approve', async (req: AuthRequest, res) => {
  try {
    const request = await TimeOffService.updateRequest(
      req.params.id,
      req.user!.orgId,
      { status: 'APPROVED', approvedById: req.user!.id, notes: req.body.notes }
    );
    
    res.status(200).json(request);
  } catch (error) {
    console.error('Approve time-off request error:', error);
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/v1/time-off/:id/deny
router.put('/:id/deny', async (req: AuthRequest, res) => {
  try {
    const request = await TimeOffService.updateRequest(
      req.params.id,
      req.user!.orgId,
      { status: 'DENIED', approvedById: req.user!.id, notes: req.body.notes }
    );
    
    res.status(200).json(request);
  } catch (error) {
    console.error('Deny time-off request error:', error);
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/v1/time-off/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await TimeOffService.deleteRequest(req.params.id, req.user!.orgId);
    
    res.status(204).send();
  } catch (error) {
    console.error('Delete time-off request error:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
