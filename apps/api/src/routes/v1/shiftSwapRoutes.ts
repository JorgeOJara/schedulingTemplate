import { Router } from 'express';
import { ShiftSwapService } from '../../services/shiftSwapService.js';
import { AuthRequest } from '../../middleware/auth.js';

const router = Router();

// GET /api/v1/shift-swaps/:id
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const swap = await ShiftSwapService.getRequest(req.params.id, req.user!.orgId);
    
    if (!swap) {
      return res.status(404).json({ error: 'Shift swap request not found' });
    }

    res.status(200).json(swap);
  } catch (error) {
    console.error('Get shift swap error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/shift-swaps
router.get('/', async (req: AuthRequest, res) => {
  try {
    const swaps = await ShiftSwapService.getOrgSwaps(req.user!.orgId, {
      status: req.query.status as string,
      requestorId: req.query.requestorId as string,
    });
    
    res.status(200).json(swaps);
  } catch (error) {
    console.error('Get shift swaps error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/shift-swaps/my-requests
router.get('/my-requests', async (req: AuthRequest, res) => {
  try {
    const swaps = await ShiftSwapService.getMySwaps(req.user!.id);
    
    res.status(200).json(swaps);
  } catch (error) {
    console.error('Get my shift swaps error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/shift-swaps
router.post('/', async (req: AuthRequest, res) => {
  try {
    const swap = await ShiftSwapService.createSwap({
      orgId: req.user!.orgId,
      requestorId: req.body.requestorId || req.user!.id,
      responderId: req.body.responderId,
      proposedShiftIds: req.body.proposedShiftIds,
      requestedShiftIds: req.body.requestedShiftIds,
      type: req.body.type,
      reason: req.body.reason,
    });
    
    res.status(201).json(swap);
  } catch (error) {
    console.error('Create shift swap error:', error);
    res.status(409).json({ error: error.message });
  }
});

// PUT /api/v1/shift-swaps/:id/accept
router.put('/:id/accept', async (req: AuthRequest, res) => {
  try {
    const swap = await ShiftSwapService.acceptSwap(
      req.params.id,
      req.user!.id,
      req.user!.orgId
    );
    
    res.status(200).json(swap);
  } catch (error) {
    console.error('Accept shift swap error:', error);
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/v1/shift-swaps/:id/deny
router.put('/:id/deny', async (req: AuthRequest, res) => {
  try {
    const swap = await ShiftSwapService.denySwap(
      req.params.id,
      req.user!.id,
      req.user!.orgId
    );
    
    res.status(200).json(swap);
  } catch (error) {
    console.error('Deny shift swap error:', error);
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/v1/shift-swaps/:id/approve
router.put('/:id/approve', async (req: AuthRequest, res) => {
  try {
    const swap = await ShiftSwapService.updateSwap(
      req.params.id,
      req.user!.orgId,
      { status: 'APPROVED', approvedById: req.user!.id, notes: req.body.notes }
    );
    
    res.status(200).json(swap);
  } catch (error) {
    console.error('Approve shift swap error:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
