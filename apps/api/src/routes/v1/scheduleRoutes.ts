import { Router } from 'express';
import { ScheduleService } from '../../services/scheduleService.js';
import { AuthRequest } from '../../middleware/auth.js';

const router = Router();

// GET /api/v1/schedules/week
router.get('/week', async (req: AuthRequest, res) => {
  try {
    const weeks = await ScheduleService.getScheduleWeeks(req.user!.orgId);
    
    res.status(200).json(weeks);
  } catch (error) {
    console.error('Get schedule weeks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/schedules/week/:id
router.get('/week/:id', async (req: AuthRequest, res) => {
  try {
    const week = await ScheduleService.getScheduleWeek(req.params.id, req.user!.orgId);
    
    if (!week) {
      return res.status(404).json({ error: 'Schedule week not found' });
    }

    res.status(200).json(week);
  } catch (error) {
    console.error('Get schedule week error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/schedules/week
router.post('/week', async (req: AuthRequest, res) => {
  try {
    const week = await ScheduleService.createScheduleWeek(
      req.user!.orgId,
      req.body.startDate,
      req.body.endDate
    );
    
    res.status(201).json(week);
  } catch (error) {
    console.error('Create schedule week error:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/v1/schedules/week/ensure
router.post('/week/ensure', async (req: AuthRequest, res) => {
  try {
    const weeksAhead = Number(req.body?.weeksAhead ?? 1);
    const result = await ScheduleService.ensurePlanningWeeks(req.user!.orgId, weeksAhead);
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Ensure schedule weeks error:', error);
    res.status(400).json({ error: error.message || 'Unable to prepare future weeks' });
  }
});

// PUT /api/v1/schedules/week/:id/publish
router.put('/week/:id/publish', async (req: AuthRequest, res) => {
  try {
    const week = await ScheduleService.publishSchedule(
      req.params.id,
      req.user!.orgId,
      req.user!.id
    );
    
    res.status(200).json(week);
  } catch (error) {
    console.error('Publish schedule error:', error);
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/v1/schedules/week/:id/unpublish
router.put('/week/:id/unpublish', async (req: AuthRequest, res) => {
  try {
    const week = await ScheduleService.unpublishSchedule(
      req.params.id,
      req.user!.orgId,
      req.user!.id
    );
    
    res.status(200).json(week);
  } catch (error) {
    console.error('Unpublish schedule error:', error);
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/v1/schedules/week/:id
router.delete('/week/:id', async (req: AuthRequest, res) => {
  try {
    await ScheduleService.deleteScheduleWeek(req.params.id, req.user!.orgId);
    
    res.status(204).send();
  } catch (error) {
    console.error('Delete schedule week error:', error);
    res.status(400).json({ error: error.message });
  }
});

// GET /api/v1/schedules/weekly-summary
router.get('/weekly-summary', async (req: AuthRequest, res) => {
  try {
    const summary = await ScheduleService.getWeeklySummary(req.user!.orgId, req.query.weekId as string);
    
    res.status(200).json(summary);
  } catch (error) {
    console.error('Get weekly summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/schedules/my-schedule
router.get('/my-schedule', async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const shifts = await ScheduleService.getEmployeeSchedule(
      req.user!.orgId,
      req.user!.id,
      String(startDate),
      String(endDate)
    );
    
    res.status(200).json(shifts);
  } catch (error) {
    console.error('Get my schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
