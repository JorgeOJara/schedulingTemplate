import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';
import { ShiftService } from './shiftService.js';
import { AuditLogService } from './auditLogService.js';

const prisma = new PrismaClient();
type SchedulingMode = 'PASSIVE' | 'PROACTIVE';

const normalizeMode = (value?: string | null): SchedulingMode =>
  value === 'PROACTIVE' ? 'PROACTIVE' : 'PASSIVE';

const buildWeekBounds = (timezone: string, offsetWeeks = 0) => {
  const today = DateTime.now().setZone(timezone).startOf('day');
  const weekday = Number(today.toFormat('c')) % 7; // Sunday=0..Saturday=6
  const start = today.minus({ days: weekday }).plus({ weeks: offsetWeeks });
  const end = start.plus({ days: 7 });
  return { start, end };
};

export const ScheduleService = {
  async createScheduleWeek(orgId: string, startDate: string, endDate: string) {
    const start = DateTime.fromISO(startDate);
    const end = DateTime.fromISO(endDate);

    if (end.diff(start, 'days').days <= 0) {
      throw new Error('End date must be after start date');
    }

    if (end.diff(start, 'days').days > 31) {
      throw new Error('Schedule week cannot exceed 31 days');
    }

    // Check for existing week
    const existing = await prisma.scheduleWeek.findFirst({
      where: {
        orgId,
        startDate: start.toJSDate(),
        endDate: end.toJSDate(),
      },
    });

    if (existing) {
      return existing;
    }

    return await prisma.scheduleWeek.create({
      data: {
        orgId,
        startDate: start.toJSDate(),
        endDate: end.toJSDate(),
      },
    });
  },

  async getScheduleWeek(weekId: string, orgId: string) {
    return await prisma.scheduleWeek.findUnique({
      where: { id: weekId, orgId },
      include: {
        shifts: {
          include: {
            employee: true,
            department: true,
            location: true,
          },
        },
      },
    });
  },

  async publishSchedule(weekId: string, orgId: string, actorId: string) {
    const week = await prisma.scheduleWeek.findUnique({
      where: { id: weekId, orgId },
    });

    if (!week) {
      throw new Error('Schedule week not found');
    }

    if (week.state === 'PUBLISHED') {
      throw new Error('Schedule is already published');
    }

    const publishedWeek = await prisma.scheduleWeek.update({
      where: { id: weekId },
      data: {
        state: 'PUBLISHED',
        publishedAt: new Date(),
        version: week.version + 1,
      },
    });

    await AuditLogService.createAuditLog(orgId, actorId, 'SCHEDULE_PUBLISHED', weekId, 'ScheduleWeek', null, publishedWeek);

    return publishedWeek;
  },

  async unpublishSchedule(weekId: string, orgId: string, actorId: string) {
    const week = await prisma.scheduleWeek.findUnique({
      where: { id: weekId, orgId },
    });

    if (!week) {
      throw new Error('Schedule week not found');
    }

    if (week.state === 'DRAFT') {
      throw new Error('Schedule is already draft');
    }

    const draftWeek = await prisma.scheduleWeek.update({
      where: { id: weekId },
      data: {
        state: 'DRAFT',
        publishedAt: null,
      },
    });

    await AuditLogService.createAuditLog(orgId, actorId, 'SCHEDULE_UNPUBLISHED', weekId, 'ScheduleWeek', { state: 'PUBLISHED' }, draftWeek);

    return draftWeek;
  },

  async updateScheduleWeek(weekId: string, orgId: string, data: { startDate?: string; endDate?: string }) {
    return await prisma.scheduleWeek.update({
      where: { id: weekId, orgId },
      data,
    });
  },

  async deleteScheduleWeek(weekId: string, orgId: string) {
    // Check if published
    const week = await prisma.scheduleWeek.findUnique({
      where: { id: weekId, orgId },
    });

    if (week?.state === 'PUBLISHED') {
      throw new Error('Cannot delete published schedule');
    }

    return await prisma.scheduleWeek.delete({
      where: { id: weekId },
    });
  },

  async getUpcomingSchedule(orgId: string, userId: string) {
    const now = new Date();

    return await prisma.scheduleWeek.findFirst({
      where: {
        orgId,
        startDate: { gte: now },
      },
      include: {
        shifts: {
          where: { employeeId: userId },
          include: {
            department: true,
            location: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });
  },

  async getScheduleWeeks(orgId: string) {
    return await prisma.scheduleWeek.findMany({
      where: { orgId },
      orderBy: { startDate: 'desc' },
    });
  },

  async ensurePlanningWeeks(orgId: string, weeksAheadRaw: number) {
    const weeksAhead = Math.max(0, Math.min(4, Math.floor(weeksAheadRaw)));

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, timezone: true, schedulingMode: true },
    });
    if (!org) {
      throw new Error('Organization not found');
    }

    const timezone = org.timezone || 'America/New_York';
    const mode = normalizeMode(org.schedulingMode);

    const { start: currentStart } = buildWeekBounds(timezone, 0);
    const targetStarts = Array.from({ length: weeksAhead + 1 }, (_, idx) => currentStart.plus({ weeks: idx }));

    const createdWeeks: string[] = [];
    const existingWeeks = await prisma.scheduleWeek.findMany({
      where: {
        orgId,
        startDate: {
          gte: currentStart.minus({ days: 7 }).toJSDate(),
          lte: currentStart.plus({ weeks: weeksAhead + 1 }).toJSDate(),
        },
      },
      orderBy: { startDate: 'asc' },
    });

    const byStartIso = new Map<string, (typeof existingWeeks)[number]>();
    existingWeeks.forEach((week) => {
      const key = DateTime.fromJSDate(week.startDate, { zone: timezone }).toISODate()!;
      byStartIso.set(key, week);
    });

    let previousWeek = existingWeeks.find((week) =>
      DateTime.fromJSDate(week.startDate, { zone: timezone }).hasSame(currentStart, 'day')
    ) ?? null;

    for (const weekStart of targetStarts) {
      const weekEnd = weekStart.plus({ days: 7 });
      const key = weekStart.toISODate()!;

      let week = byStartIso.get(key) ?? null;
      if (!week) {
        week = await prisma.scheduleWeek.create({
          data: {
            orgId,
            startDate: weekStart.toJSDate(),
            endDate: weekEnd.toJSDate(),
          },
        });
        byStartIso.set(key, week);
        createdWeeks.push(week.id);
      }

      const existingShiftCount = await prisma.shift.count({ where: { scheduleWeekId: week.id } });
      if (existingShiftCount === 0) {
        if (previousWeek) {
          const seededCount = await this.seedWeekFromPreviousWeek(previousWeek.id, week.id, timezone, mode);
          if (seededCount === 0) {
            await this.seedWeekFromDefaultTemplates(orgId, week.id, timezone);
          }
        } else {
          await this.seedWeekFromDefaultTemplates(orgId, week.id, timezone);
        }
      }

      previousWeek = week;
    }

    const weeks = await this.getScheduleWeeks(orgId);
    return { createdWeeks, weeks, schedulingMode: mode };
  },

  async seedWeekFromPreviousWeek(
    sourceWeekId: string,
    targetWeekId: string,
    timezone: string,
    mode: SchedulingMode
  ) {
    const sourceShifts = await prisma.shift.findMany({ where: { scheduleWeekId: sourceWeekId } });
    if (sourceShifts.length === 0) {
      return 0;
    }

    const targetShifts = await prisma.shift.count({ where: { scheduleWeekId: targetWeekId } });
    if (targetShifts > 0) {
      return 0;
    }

    const payload = sourceShifts.map((shift) => ({
      scheduleWeekId: targetWeekId,
      employeeId: mode === 'PASSIVE' ? shift.employeeId : null,
      departmentId: shift.departmentId,
      locationId: shift.locationId,
      startTime: DateTime.fromJSDate(shift.startTime, { zone: timezone }).plus({ weeks: 1 }).toJSDate(),
      endTime: DateTime.fromJSDate(shift.endTime, { zone: timezone }).plus({ weeks: 1 }).toJSDate(),
      breakDurationMinutes: shift.breakDurationMinutes,
      breakIsPaid: shift.breakIsPaid,
      notes: shift.notes,
      shiftType: shift.shiftType,
      isOnCall: shift.isOnCall,
      status: 'SCHEDULED',
      shiftGroup: shift.shiftGroup,
      version: 1,
    }));

    await prisma.shift.createMany({ data: payload });
    return payload.length;
  },

  async seedWeekFromDefaultTemplates(orgId: string, weekId: string, timezone: string) {
    const [week, templates] = await Promise.all([
      prisma.scheduleWeek.findUnique({ where: { id: weekId } }),
      prisma.defaultShiftTemplate.findMany({ where: { orgId, active: true } }),
    ]);

    if (!week || templates.length === 0) {
      return 0;
    }

    const weekStart = DateTime.fromJSDate(week.startDate, { zone: timezone });
    const weekStartDay = Number(weekStart.toFormat('c')) % 7;
    const data: Array<{
      scheduleWeekId: string;
      employeeId: null;
      departmentId: string | null;
      locationId: string | null;
      startTime: Date;
      endTime: Date;
      breakDurationMinutes: number;
      breakIsPaid: false;
      notes: string;
      shiftType: string;
      isOnCall: boolean;
      status: string;
      version: number;
      shiftGroup: string;
    }> = [];

    for (const template of templates) {
      const offset = (template.dayOfWeek - weekStartDay + 7) % 7;
      const shiftDay = weekStart.plus({ days: offset });
      const dayLabel = shiftDay.toFormat('yyyy-LL-dd');

      const start = DateTime.fromFormat(`${dayLabel} ${template.startTime}`, 'yyyy-LL-dd HH:mm', { zone: timezone });
      let end = DateTime.fromFormat(`${dayLabel} ${template.endTime}`, 'yyyy-LL-dd HH:mm', { zone: timezone });
      if (end <= start) {
        end = end.plus({ days: 1 });
      }

      const count = Math.max(template.requiredHeadcount || 1, 1);
      for (let i = 0; i < count; i += 1) {
        data.push({
          scheduleWeekId: weekId,
          employeeId: null,
          departmentId: template.departmentId,
          locationId: template.locationId,
          startTime: start.toJSDate(),
          endTime: end.toJSDate(),
          breakDurationMinutes: template.breakDurationMinutes,
          breakIsPaid: false,
          notes: `From default template: ${template.name}`,
          shiftType: 'REGULAR',
          isOnCall: false,
          status: 'SCHEDULED',
          version: 1,
          shiftGroup: 'template',
        });
      }
    }

    if (data.length > 0) {
      await prisma.shift.createMany({ data });
    }

    return data.length;
  },

  async getEmployeeSchedule(orgId: string, userId: string, startDate: string, endDate: string) {
    const scheduleWeeks = await prisma.scheduleWeek.findMany({
      where: { orgId },
    });

    const weekIds = scheduleWeeks.map(w => w.id);

    return await prisma.shift.findMany({
      where: {
        employeeId: userId,
        scheduleWeekId: { in: weekIds },
        OR: [
          { startTime: { gte: new Date(startDate), lte: new Date(endDate) } },
          { endTime: { gte: new Date(startDate), lte: new Date(endDate) } },
        ],
      },
      include: {
        department: true,
        location: true,
      },
      orderBy: { startTime: 'asc' },
    });
  },

  async getWeeklySummary(orgId: string, weekId: string) {
    const week = await prisma.scheduleWeek.findUnique({
      where: { id: weekId, orgId },
    });

    if (!week) {
      throw new Error('Schedule week not found');
    }

    const shifts = await prisma.shift.findMany({
      where: { scheduleWeekId: weekId },
      include: { employee: true, department: true, location: true },
    });

    const org = await prisma.organization.findUnique({ where: { id: orgId } });

    if (!org) {
      throw new Error('Organization not found');
    }

    const overtime = ShiftService.calculateOvertime(shifts, org);

    const employeesShiftCount = shifts.reduce((acc, shift) => {
      if (shift.employeeId) {
        acc[shift.employeeId] = (acc[shift.employeeId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const departmentHours = shifts.reduce((acc, shift) => {
      if (shift.departmentId) {
        const hours = this.calculateShiftHours(shift);
        acc[shift.departmentId] = (acc[shift.departmentId] || 0) + hours;
      }
      return acc;
    }, {} as Record<string, number>);

    const locationHours = shifts.reduce((acc, shift) => {
      if (shift.locationId) {
        const hours = this.calculateShiftHours(shift);
        acc[shift.locationId] = (acc[shift.locationId] || 0) + hours;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      totalShifts: shifts.length,
      totalEmployeesScheduled: new Set(shifts.map(s => s.employeeId).filter(Boolean)).size,
      overtime,
      employeesShiftCount,
      departmentHours,
      locationHours,
    };
  },

  calculateShiftHours(shift: any) {
    const start = DateTime.fromISO(shift.startTime.toISOString());
    const end = DateTime.fromISO(shift.endTime.toISOString());
    return Math.round(end.diff(start, 'hours').hours * 100) / 100;
  },
};
