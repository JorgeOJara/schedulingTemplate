import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface BusinessHourInput {
  dayOfWeek: number;
  openTime?: string | null;
  closeTime?: string | null;
  isClosed?: boolean;
}

export interface DefaultShiftTemplateInput {
  name?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakDurationMinutes?: number;
  requiredHeadcount?: number;
  departmentId?: string | null;
  locationId?: string | null;
  active?: boolean;
}

export interface OrgSetupInput {
  timezone?: string;
  clockInEarlyAllowanceMinutes?: number;
  dailyOtcThreshold?: number;
  weeklyOtcThreshold?: number;
  maxHoursPerWeek?: number;
  schedulingMode?: 'PASSIVE' | 'PROACTIVE';
  aiAutoScheduleEnabled?: boolean;
  businessHours: BusinessHourInput[];
  defaultShiftTemplates: DefaultShiftTemplateInput[];
}

const normalizeBusinessHours = (hours: BusinessHourInput[]): BusinessHourInput[] => {
  const byDay = new Map<number, BusinessHourInput>();
  for (const entry of hours) {
    if (!Number.isInteger(entry.dayOfWeek) || entry.dayOfWeek < 0 || entry.dayOfWeek > 6) {
      throw new Error('Business hour dayOfWeek must be between 0 and 6');
    }

    const isClosed = entry.isClosed ?? false;
    if (!isClosed) {
      if (!entry.openTime || !TIME_24H_REGEX.test(entry.openTime)) {
        throw new Error(`Invalid openTime for day ${entry.dayOfWeek}`);
      }
      if (!entry.closeTime || !TIME_24H_REGEX.test(entry.closeTime)) {
        throw new Error(`Invalid closeTime for day ${entry.dayOfWeek}`);
      }
      if (entry.openTime >= entry.closeTime) {
        throw new Error(`closeTime must be later than openTime for day ${entry.dayOfWeek}`);
      }
    }

    byDay.set(entry.dayOfWeek, {
      dayOfWeek: entry.dayOfWeek,
      openTime: isClosed ? null : entry.openTime ?? null,
      closeTime: isClosed ? null : entry.closeTime ?? null,
      isClosed,
    });
  }

  for (let day = 0; day <= 6; day += 1) {
    if (!byDay.has(day)) {
      const isWeekend = day === 0 || day === 6;
      byDay.set(day, {
        dayOfWeek: day,
        openTime: isWeekend ? null : '09:00',
        closeTime: isWeekend ? null : '17:00',
        isClosed: isWeekend,
      });
    }
  }

  return [...byDay.values()].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
};

const normalizeTemplates = (templates: DefaultShiftTemplateInput[]): DefaultShiftTemplateInput[] => {
  return templates.map((template, idx) => {
    if (!Number.isInteger(template.dayOfWeek) || template.dayOfWeek < 0 || template.dayOfWeek > 6) {
      throw new Error(`Default shift template #${idx + 1}: dayOfWeek must be between 0 and 6`);
    }
    if (!TIME_24H_REGEX.test(template.startTime) || !TIME_24H_REGEX.test(template.endTime)) {
      throw new Error(`Default shift template #${idx + 1}: startTime/endTime must use HH:mm format`);
    }
    if (template.requiredHeadcount !== undefined && template.requiredHeadcount < 1) {
      throw new Error(`Default shift template #${idx + 1}: requiredHeadcount must be at least 1`);
    }
    if (template.breakDurationMinutes !== undefined && template.breakDurationMinutes < 0) {
      throw new Error(`Default shift template #${idx + 1}: breakDurationMinutes cannot be negative`);
    }

    return {
      name: template.name?.trim() || `Shift ${idx + 1}`,
      dayOfWeek: template.dayOfWeek,
      startTime: template.startTime,
      endTime: template.endTime,
      breakDurationMinutes: template.breakDurationMinutes ?? 0,
      requiredHeadcount: template.requiredHeadcount ?? 1,
      departmentId: template.departmentId ?? null,
      locationId: template.locationId ?? null,
      active: template.active ?? true,
    };
  });
};

const isTemplateOnOpenDay = (
  template: DefaultShiftTemplateInput,
  businessHoursByDay: Map<number, BusinessHourInput>
) => {
  const dayHours = businessHoursByDay.get(template.dayOfWeek);
  return Boolean(dayHours && !dayHours.isClosed);
};

export const SetupService = {
  async getOrgSetup(orgId: string) {
    const [org, businessHours, defaultShiftTemplates] = await Promise.all([
      prisma.organization.findFirst({
        where: { id: orgId },
        select: {
          id: true,
          name: true,
          timezone: true,
          setupCompleted: true,
          clockInEarlyAllowanceMinutes: true,
          dailyOtcThreshold: true,
          weeklyOtcThreshold: true,
          maxHoursPerWeek: true,
          schedulingMode: true,
          aiAutoScheduleEnabled: true,
        },
      }),
      prisma.businessHour.findMany({
        where: { orgId },
        orderBy: { dayOfWeek: 'asc' },
      }),
      prisma.defaultShiftTemplate.findMany({
        where: { orgId },
        include: {
          department: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      }),
    ]);

    if (!org) {
      throw new Error('Organization not found');
    }

    const normalizedHours = businessHours.length > 0 ? businessHours : normalizeBusinessHours([]);

    return {
      ...org,
      businessHours: normalizedHours,
      defaultShiftTemplates,
    };
  },

  async completeOrgSetup(orgId: string, data: OrgSetupInput) {
    const normalizedHours = normalizeBusinessHours(data.businessHours ?? []);
    const normalizedTemplates = normalizeTemplates(data.defaultShiftTemplates ?? []);
    const hoursByDay = new Map<number, BusinessHourInput>(
      normalizedHours.map((entry) => [entry.dayOfWeek, entry])
    );

    if (
      data.clockInEarlyAllowanceMinutes !== undefined &&
      (data.clockInEarlyAllowanceMinutes < 0 || data.clockInEarlyAllowanceMinutes > 60)
    ) {
      throw new Error('clockInEarlyAllowanceMinutes must be between 0 and 60');
    }
    if (data.dailyOtcThreshold !== undefined && (data.dailyOtcThreshold < 0 || data.dailyOtcThreshold > 24)) {
      throw new Error('dailyOtcThreshold must be between 0 and 24');
    }
    if (data.weeklyOtcThreshold !== undefined && (data.weeklyOtcThreshold < 0 || data.weeklyOtcThreshold > 168)) {
      throw new Error('weeklyOtcThreshold must be between 0 and 168');
    }
    if (data.maxHoursPerWeek !== undefined && (data.maxHoursPerWeek < 0 || data.maxHoursPerWeek > 168)) {
      throw new Error('maxHoursPerWeek must be between 0 and 168');
    }
    if (
      data.timezone !== undefined &&
      !DateTime.now().setZone(data.timezone).isValid
    ) {
      throw new Error('Invalid timezone');
    }
    if (data.schedulingMode !== undefined && !['PASSIVE', 'PROACTIVE'].includes(data.schedulingMode)) {
      throw new Error('schedulingMode must be PASSIVE or PROACTIVE');
    }
    if (data.aiAutoScheduleEnabled === true) {
      throw new Error('AI auto-schedule is not available yet');
    }

    const [departments, locations] = await Promise.all([
      prisma.department.findMany({
        where: { orgId, active: true },
        select: { id: true },
      }),
      prisma.location.findMany({
        where: { orgId, active: true },
        select: { id: true },
      }),
    ]);

    const validDepartmentIds = new Set(departments.map((item) => item.id));
    const validLocationIds = new Set(locations.map((item) => item.id));

    normalizedTemplates.forEach((template, index) => {
      if (!isTemplateOnOpenDay(template, hoursByDay)) {
        throw new Error(
          `Default shift template #${index + 1} is on a closed day`
        );
      }
      if (template.departmentId && !validDepartmentIds.has(template.departmentId)) {
        throw new Error(`Default shift template #${index + 1} has an invalid department`);
      }
      if (template.locationId && !validLocationIds.has(template.locationId)) {
        throw new Error(`Default shift template #${index + 1} has an invalid location`);
      }
    });

    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: orgId },
        data: {
          timezone: data.timezone,
          dailyOtcThreshold: data.dailyOtcThreshold,
          weeklyOtcThreshold: data.weeklyOtcThreshold,
          maxHoursPerWeek: data.maxHoursPerWeek,
          clockInEarlyAllowanceMinutes: data.clockInEarlyAllowanceMinutes,
          schedulingMode: data.schedulingMode,
          aiAutoScheduleEnabled: data.aiAutoScheduleEnabled ?? false,
          setupCompleted: true,
        },
      });

      await tx.businessHour.deleteMany({ where: { orgId } });
      if (normalizedHours.length > 0) {
        await tx.businessHour.createMany({
          data: normalizedHours.map((entry) => ({
            orgId,
            dayOfWeek: entry.dayOfWeek,
            openTime: entry.openTime ?? null,
            closeTime: entry.closeTime ?? null,
            isClosed: entry.isClosed ?? false,
          })),
        });
      }

      await tx.defaultShiftTemplate.deleteMany({ where: { orgId } });
      if (normalizedTemplates.length > 0) {
        await tx.defaultShiftTemplate.createMany({
          data: normalizedTemplates.map((template) => ({
            orgId,
            name: template.name ?? 'Shift',
            dayOfWeek: template.dayOfWeek,
            startTime: template.startTime,
            endTime: template.endTime,
            breakDurationMinutes: template.breakDurationMinutes ?? 0,
            requiredHeadcount: template.requiredHeadcount ?? 1,
            departmentId: template.departmentId ?? null,
            locationId: template.locationId ?? null,
            active: template.active ?? true,
          })),
        });
      }
    });

    return this.getOrgSetup(orgId);
  },

  async applyDefaultTemplatesToWeek(orgId: string, weekId: string) {
    const [week, org, templates, existingShifts] = await Promise.all([
      prisma.scheduleWeek.findFirst({
        where: { id: weekId, orgId },
      }),
      prisma.organization.findFirst({
        where: { id: orgId },
        select: { timezone: true },
      }),
      prisma.defaultShiftTemplate.findMany({
        where: { orgId, active: true },
      }),
      prisma.shift.findMany({
        where: { scheduleWeekId: weekId },
      }),
    ]);

    if (!week) {
      throw new Error('Schedule week not found');
    }
    if (week.state === 'PUBLISHED') {
      throw new Error('Cannot apply default templates to a published schedule');
    }
    if (!org) {
      throw new Error('Organization not found');
    }
    if (templates.length === 0) {
      return { createdCount: 0 };
    }

    const weekStart = DateTime.fromJSDate(week.startDate, { zone: org.timezone });
    const weekStartDay = Number(weekStart.toFormat('c')) % 7;

    const existingByKey = new Map<string, number>();
    for (const shift of existingShifts) {
      const key = [
        DateTime.fromJSDate(shift.startTime, { zone: org.timezone }).toFormat('yyyy-LL-dd'),
        DateTime.fromJSDate(shift.startTime, { zone: org.timezone }).toFormat('HH:mm'),
        DateTime.fromJSDate(shift.endTime, { zone: org.timezone }).toFormat('HH:mm'),
        shift.departmentId ?? '',
        shift.locationId ?? '',
      ].join('|');
      existingByKey.set(key, (existingByKey.get(key) ?? 0) + 1);
    }

    const shiftsToCreate: Array<{
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
    }> = [];

    for (const template of templates) {
      const offset = (template.dayOfWeek - weekStartDay + 7) % 7;
      const shiftDay = weekStart.plus({ days: offset });
      const dayLabel = shiftDay.toFormat('yyyy-LL-dd');

      const start = DateTime.fromFormat(
        `${dayLabel} ${template.startTime}`,
        'yyyy-LL-dd HH:mm',
        { zone: org.timezone }
      );
      let end = DateTime.fromFormat(
        `${dayLabel} ${template.endTime}`,
        'yyyy-LL-dd HH:mm',
        { zone: org.timezone }
      );

      if (end <= start) {
        end = end.plus({ days: 1 });
      }

      const key = [dayLabel, template.startTime, template.endTime, template.departmentId ?? '', template.locationId ?? ''].join('|');
      const existingCount = existingByKey.get(key) ?? 0;
      const needed = Math.max((template.requiredHeadcount || 1) - existingCount, 0);

      for (let i = 0; i < needed; i += 1) {
        shiftsToCreate.push({
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
        });
      }

      if (needed > 0) {
        existingByKey.set(key, existingCount + needed);
      }
    }

    if (shiftsToCreate.length > 0) {
      await prisma.shift.createMany({ data: shiftsToCreate });
    }

    return { createdCount: shiftsToCreate.length };
  },
};
