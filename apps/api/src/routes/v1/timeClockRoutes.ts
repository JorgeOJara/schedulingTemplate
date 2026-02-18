import { Router } from 'express';
import { AuthRequest } from '../../middleware/auth.js';
import { TimeClockService } from '../../services/timeClockService.js';
import { z } from 'zod';

const router = Router();

const clockInSchema = z.object({
  shiftId: z.string().uuid().optional(),
  force: z.boolean().optional(),
});

const clockOutSchema = z.object({
  timeEntryId: z.string().uuid().optional(),
  shiftId: z.string().uuid().optional(),
}).refine(
  (value) => !(value.timeEntryId && value.shiftId),
  { message: 'Provide either timeEntryId or shiftId, not both' }
);

const myWeekQuerySchema = z.object({
  weekStart: z.string().datetime().optional(),
});

// GET /api/v1/time-clock/status
router.get('/status', async (req: AuthRequest, res) => {
  try {
    const status = await TimeClockService.getClockStatus(req.user!.orgId, req.user!.id);
    res.status(200).json(status);
  } catch (error) {
    console.error('Get clock status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/time-clock/clock-in
router.post('/clock-in', async (req: AuthRequest, res) => {
  try {
    const body = clockInSchema.parse(req.body ?? {});
    const entry = await TimeClockService.clockIn(req.user!.orgId, req.user!.id, body.shiftId, body.force);
    res.status(201).json(entry);
  } catch (error: any) {
    console.error('Clock-in error:', error);
    res.status(400).json({ error: error.message || 'Unable to clock in' });
  }
});

// POST /api/v1/time-clock/clock-out
router.post('/clock-out', async (req: AuthRequest, res) => {
  try {
    const body = clockOutSchema.parse(req.body ?? {});
    const entry = await TimeClockService.clockOut(req.user!.orgId, req.user!.id, body);
    res.status(200).json(entry);
  } catch (error: any) {
    console.error('Clock-out error:', error);
    res.status(400).json({ error: error.message || 'Unable to clock out' });
  }
});

// GET /api/v1/time-clock/my-week
router.get('/my-week', async (req: AuthRequest, res) => {
  try {
    const query = myWeekQuerySchema.parse({
      weekStart: req.query.weekStart ? String(req.query.weekStart) : undefined,
    });
    const report = await TimeClockService.getMyWeeklyHours(
      req.user!.orgId,
      req.user!.id,
      query.weekStart
    );
    res.status(200).json(report);
  } catch (error: any) {
    console.error('Get my weekly hours error:', error);
    res.status(400).json({ error: error.message || 'Unable to get weekly hours' });
  }
});

// GET /api/v1/time-clock/overtime-requests
router.get('/overtime-requests', async (req: AuthRequest, res) => {
  try {
    if (!['ADMIN', 'MANAGER'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Only managers can review overtime requests' });
    }
    const requests = await TimeClockService.getPendingOvertimeRequests(req.user!.orgId);
    res.status(200).json(requests);
  } catch (error: any) {
    console.error('Get overtime requests error:', error);
    res.status(400).json({ error: error.message || 'Unable to get overtime requests' });
  }
});

// PUT /api/v1/time-clock/overtime-requests/:id/approve
router.put('/overtime-requests/:id/approve', async (req: AuthRequest, res) => {
  try {
    if (!['ADMIN', 'MANAGER'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Only managers can approve overtime requests' });
    }
    const updated = await TimeClockService.reviewOvertimeRequest(
      req.user!.orgId,
      req.user!.id,
      String(req.params.id),
      'APPROVE'
    );
    res.status(200).json(updated);
  } catch (error: any) {
    console.error('Approve overtime request error:', error);
    res.status(400).json({ error: error.message || 'Unable to approve overtime request' });
  }
});

// PUT /api/v1/time-clock/overtime-requests/:id/deny
router.put('/overtime-requests/:id/deny', async (req: AuthRequest, res) => {
  try {
    if (!['ADMIN', 'MANAGER'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Only managers can deny overtime requests' });
    }
    const updated = await TimeClockService.reviewOvertimeRequest(
      req.user!.orgId,
      req.user!.id,
      String(req.params.id),
      'DENY'
    );
    res.status(200).json(updated);
  } catch (error: any) {
    console.error('Deny overtime request error:', error);
    res.status(400).json({ error: error.message || 'Unable to deny overtime request' });
  }
});

export default router;
