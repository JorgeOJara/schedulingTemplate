import { Router } from 'express';
import { AnalyticsService } from '../../services/analyticsService.js';
import { AuthRequest, rbacMiddleware } from '../../middleware/auth.js';
import { TimeClockService } from '../../services/timeClockService.js';
import { z } from 'zod';

const router = Router();

// GET /api/v1/analytics/weekly-summary
router.get('/weekly-summary', rbacMiddleware(['ADMIN', 'MANAGER']), async (req: AuthRequest, res) => {
  try {
    const weekId = req.query.weekId ? z.string().uuid().parse(String(req.query.weekId)) : undefined;
    const summary = await AnalyticsService.getWeeklySummary(req.user!.orgId, weekId);
    
    res.status(200).json(summary);
  } catch (error) {
    console.error('Get weekly summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/analytics/department-breakdown
router.get('/department-breakdown', rbacMiddleware(['ADMIN', 'MANAGER']), async (req: AuthRequest, res) => {
  try {
    const breakdown = await AnalyticsService.getDepartmentBreakdown(req.user!.orgId);
    
    res.status(200).json(breakdown);
  } catch (error) {
    console.error('Get department breakdown error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/analytics/coverage-metrics
router.get('/coverage-metrics', rbacMiddleware(['ADMIN', 'MANAGER']), async (req: AuthRequest, res) => {
  try {
    const weekId = req.query.weekId ? z.string().uuid().parse(String(req.query.weekId)) : undefined;
    const metrics = await AnalyticsService.getCoverageMetrics(req.user!.orgId, weekId);
    
    res.status(200).json(metrics);
  } catch (error) {
    console.error('Get coverage metrics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/analytics/stats
router.get('/stats', rbacMiddleware(['ADMIN', 'MANAGER']), async (req: AuthRequest, res) => {
  try {
    const stats = await AnalyticsService.getOrgStats(req.user!.orgId);
    
    res.status(200).json(stats);
  } catch (error) {
    console.error('Get org stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/analytics/hours-comparison
router.get('/hours-comparison', rbacMiddleware(['ADMIN', 'MANAGER']), async (req: AuthRequest, res) => {
  try {
    const weekId = req.query.weekId ? z.string().uuid().parse(String(req.query.weekId)) : undefined;
    const exportFormat = req.query.export ? String(req.query.export) : undefined;

    const report = await TimeClockService.getOrgWeeklyHoursComparison(
      req.user!.orgId,
      weekId
    );

    if (exportFormat === 'csv') {
      const headers = [
        'Employee Name',
        'Email',
        'Scheduled Hours',
        'Actual Hours',
        'Difference Hours',
        'Completion Rate (%)',
        'Late Clock-ins',
      ];

      const rows = report.employees.map((employee) => [
        employee.employeeName,
        employee.email,
        employee.scheduledHours.toFixed(2),
        employee.actualHours.toFixed(2),
        employee.differenceHours.toFixed(2),
        String(employee.completionRatePct),
        String(employee.lateClockIns),
      ]);

      const csv = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="hours-comparison-${report.weekStart.toISOString().slice(0, 10)}.csv"`
      );
      return res.status(200).send(csv);
    }

    res.status(200).json(report);
  } catch (error) {
    console.error('Get hours comparison error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
