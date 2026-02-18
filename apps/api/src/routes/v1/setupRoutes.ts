import { Router } from 'express';
import { AuthRequest, rbacMiddleware } from '../../middleware/auth.js';
import { SetupService } from '../../services/setupService.js';
import type { OrgSetupInput } from '../../services/setupService.js';
import { z } from 'zod';

const router = Router();

const setupPayloadSchema = z.object({
  timezone: z.string().min(1).optional(),
  clockInEarlyAllowanceMinutes: z.number().int().min(0).max(60).optional(),
  dailyOtcThreshold: z.number().int().min(0).max(24).optional(),
  weeklyOtcThreshold: z.number().int().min(0).max(168).optional(),
  maxHoursPerWeek: z.number().int().min(0).max(168).optional(),
  schedulingMode: z.enum(['PASSIVE', 'PROACTIVE']).optional(),
  aiAutoScheduleEnabled: z.boolean().optional(),
  businessHours: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      openTime: z.string().nullable().optional(),
      closeTime: z.string().nullable().optional(),
      isClosed: z.boolean().optional(),
    })
  ),
  defaultShiftTemplates: z.array(
    z.object({
      name: z.string().optional(),
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string(),
      endTime: z.string(),
      breakDurationMinutes: z.number().int().min(0).optional(),
      requiredHeadcount: z.number().int().min(1).optional(),
      departmentId: z.string().nullable().optional(),
      locationId: z.string().nullable().optional(),
      active: z.boolean().optional(),
    })
  ),
});

// GET /api/v1/setup/org
router.get('/org', rbacMiddleware(['ADMIN', 'MANAGER']), async (req: AuthRequest, res) => {
  try {
    const setup = await SetupService.getOrgSetup(req.user!.orgId);
    res.status(200).json(setup);
  } catch (error) {
    console.error('Get org setup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/setup/org
router.put('/org', rbacMiddleware(['ADMIN', 'MANAGER']), async (req: AuthRequest, res) => {
  try {
    const payload = setupPayloadSchema.parse(req.body) as OrgSetupInput;
    const setup = await SetupService.completeOrgSetup(req.user!.orgId, payload);
    res.status(200).json(setup);
  } catch (error: any) {
    console.error('Complete org setup error:', error);
    res.status(400).json({ error: error.message || 'Unable to complete setup' });
  }
});

// POST /api/v1/setup/week/:weekId/apply-defaults
router.post('/week/:weekId/apply-defaults', rbacMiddleware(['ADMIN', 'MANAGER']), async (req: AuthRequest, res) => {
  try {
    const weekId = z.string().uuid().parse(String(req.params.weekId));
    const result = await SetupService.applyDefaultTemplatesToWeek(req.user!.orgId, weekId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Apply default templates error:', error);
    res.status(400).json({ error: error.message || 'Unable to apply default templates' });
  }
});

export default router;
