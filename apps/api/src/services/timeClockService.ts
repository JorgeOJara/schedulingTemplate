import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';
import { NotificationService } from './notificationService.js';

const prisma = new PrismaClient();

const asHours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

const calculateWorkedMinutes = (clockInAt: Date, clockOutAt: Date) =>
  Math.max(Math.floor((clockOutAt.getTime() - clockInAt.getTime()) / (1000 * 60)), 0);

const startOfWeekSunday = (date: Date) => {
  const copy = new Date(date);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const getClockEligibleWindow = (shiftStart: Date, shiftEnd: Date, allowanceMinutes: number) => {
  const earliestClockIn = DateTime.fromJSDate(shiftStart).minus({ minutes: allowanceMinutes });
  const latestClockIn = DateTime.fromJSDate(shiftEnd).plus({ hours: 2 });
  return { earliestClockIn, latestClockIn };
};

const findBestEligibleShift = (
  shifts: Array<{ id: string; startTime: Date; endTime: Date }>,
  now: DateTime,
  allowanceMinutes: number
) => {
  if (shifts.length === 0) {
    return { shift: null, earliestClockInAt: null as string | null, canClockIn: false };
  }

  const withWindow = shifts.map((shift) => {
    const window = getClockEligibleWindow(shift.startTime, shift.endTime, allowanceMinutes);
    return { shift, ...window };
  });

  const currentlyEligible = withWindow
    .filter((row) => now >= row.earliestClockIn && now <= row.latestClockIn)
    .sort((a, b) => a.shift.startTime.getTime() - b.shift.startTime.getTime())[0];

  if (currentlyEligible) {
    return {
      shift: currentlyEligible.shift,
      earliestClockInAt: currentlyEligible.earliestClockIn.toISO(),
      canClockIn: true,
    };
  }

  const upcoming = withWindow
    .filter((row) => now < row.earliestClockIn)
    .sort((a, b) => a.shift.startTime.getTime() - b.shift.startTime.getTime())[0];

  if (!upcoming) {
    return { shift: null, earliestClockInAt: null, canClockIn: false };
  }

  return {
    shift: upcoming.shift,
    earliestClockInAt: upcoming.earliestClockIn.toISO(),
    canClockIn: false,
  };
};

export const TimeClockService = {
  async getClockStatus(orgId: string, userId: string) {
    const now = DateTime.now();
    const [org, activeEntry, nextShift] = await Promise.all([
      prisma.organization.findFirst({
        where: { id: orgId },
        select: { clockInEarlyAllowanceMinutes: true, timezone: true },
      }),
      prisma.timeEntry.findFirst({
        where: {
          orgId,
          employeeId: userId,
          clockOutAt: null,
          status: 'CLOCKED_IN',
        },
        include: {
          shift: {
            include: {
              department: true,
              location: true,
            },
          },
        },
        orderBy: { clockInAt: 'desc' },
      }),
      prisma.shift.findMany({
        where: {
          employeeId: userId,
          scheduleWeek: { orgId },
          endTime: { gte: now.minus({ hours: 12 }).toJSDate() },
          startTime: { lte: now.plus({ days: 1 }).toJSDate() },
        },
        orderBy: { startTime: 'asc' },
        take: 8,
      }),
    ]);

    if (!org) {
      throw new Error('Organization not found');
    }

    const allowance = org.clockInEarlyAllowanceMinutes || 5;
    const best = findBestEligibleShift(nextShift, now, allowance);
    const eligibleShift = best.shift
      ? {
          id: best.shift.id,
          startTime: best.shift.startTime,
          endTime: best.shift.endTime,
          canClockIn: best.canClockIn,
        }
      : null;

    return {
      policy: {
        clockInEarlyAllowanceMinutes: allowance,
        timezone: org.timezone,
      },
      activeEntry,
      eligibleShift,
      earliestClockInAt: best.earliestClockInAt,
    };
  },

  async clockIn(orgId: string, userId: string, shiftId?: string, force = false) {
    const now = DateTime.now();
    const org = await prisma.organization.findFirst({
      where: { id: orgId },
      select: { clockInEarlyAllowanceMinutes: true, timezone: true },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    const activeEntry = await prisma.timeEntry.findFirst({
      where: {
        orgId,
        employeeId: userId,
        status: 'CLOCKED_IN',
        clockOutAt: null,
      },
    });

    if (activeEntry) {
      throw new Error('You are already clocked in');
    }

    let shift = null;
    if (force && !shiftId) {
      return await prisma.timeEntry.create({
        data: {
          orgId,
          employeeId: userId,
          shiftId: null,
          clockInAt: now.toJSDate(),
          scheduledStart: null,
          scheduledEnd: null,
          isLate: false,
          lateByMinutes: 0,
          status: 'CLOCKED_IN',
          notes: 'Manual clock-in (force)',
        },
      });
    }

    if (shiftId) {
      shift = await prisma.shift.findFirst({
        where: {
          id: shiftId,
          employeeId: userId,
          scheduleWeek: { orgId },
        },
      });
      if (!shift) {
        throw new Error('Assigned shift not found for clock in');
      }
    } else {
      const shifts = await prisma.shift.findMany({
        where: {
          employeeId: userId,
          scheduleWeek: { orgId },
          endTime: { gte: now.minus({ hours: 12 }).toJSDate() },
          startTime: { lte: now.plus({ days: 1 }).toJSDate() },
        },
        orderBy: { startTime: 'asc' },
        take: 8,
      });
      shift = findBestEligibleShift(shifts, now, org.clockInEarlyAllowanceMinutes || 5).shift;
    }

    // Allow manual clock-ins when there is no eligible assigned shift.
    if (!shift) {
      return await prisma.timeEntry.create({
        data: {
          orgId,
          employeeId: userId,
          shiftId: null,
          clockInAt: now.toJSDate(),
          scheduledStart: null,
          scheduledEnd: null,
          isLate: false,
          lateByMinutes: 0,
          status: 'CLOCKED_IN',
          notes: 'Manual clock-in (no assigned shift)',
        },
      });
    }

    const allowance = org.clockInEarlyAllowanceMinutes || 5;
    const { earliestClockIn, latestClockIn } = getClockEligibleWindow(
      shift.startTime,
      shift.endTime,
      allowance
    );
    if (now < earliestClockIn) {
      throw new Error(
        `Too early to clock in. Earliest allowed clock-in is ${earliestClockIn.toFormat('h:mm a')}`
      );
    }

    if (now > latestClockIn) {
      throw new Error('This shift is no longer eligible for clock in');
    }

    const existingEntriesForShift = await prisma.timeEntry.findMany({
      where: {
        orgId,
        employeeId: userId,
        shiftId: shift.id,
      },
      orderBy: { clockInAt: 'asc' },
    });

    if (existingEntriesForShift.length >= 3) {
      throw new Error('Maximum of 3 clock-in/out records allowed for this shift');
    }

    const isFirstClockInForShift = existingEntriesForShift.length === 0;
    const lateByMinutes = isFirstClockInForShift
      ? Math.max(Math.floor((now.toJSDate().getTime() - shift.startTime.getTime()) / (1000 * 60)), 0)
      : 0;
    const isLate = isFirstClockInForShift && lateByMinutes > 0;

    const entry = await prisma.timeEntry.create({
      data: {
        orgId,
        employeeId: userId,
        shiftId: shift.id,
        clockInAt: now.toJSDate(),
        scheduledStart: shift.startTime,
        scheduledEnd: shift.endTime,
        isLate,
        lateByMinutes,
        status: 'CLOCKED_IN',
      },
      include: {
        shift: {
          include: {
            department: true,
            location: true,
          },
        },
      },
    });

    if (isLate) {
      const [employee, managers] = await Promise.all([
        prisma.user.findFirst({
          where: { id: userId },
          select: { firstName: true, lastName: true },
        }),
        prisma.user.findMany({
          where: {
            orgId,
            isActive: true,
            role: { in: ['ADMIN', 'MANAGER'] },
          },
          select: { id: true },
        }),
      ]);

      const employeeName = employee
        ? `${employee.firstName} ${employee.lastName}`
        : 'An employee';

      await Promise.all(
        managers.map((manager) =>
          NotificationService.createNotification(
            orgId,
            manager.id,
            `Late clock-in (${lateByMinutes}m)`,
            `${employeeName} clocked in ${lateByMinutes} minute(s) late.`,
            'WARNING',
            entry.id,
            'TIME_ENTRY'
          )
        )
      );
    }

    return entry;
  },

  async clockOut(orgId: string, userId: string, payload: { timeEntryId?: string; shiftId?: string }) {
    const now = new Date();
    let entry = null;

    if (payload.timeEntryId) {
      entry = await prisma.timeEntry.findFirst({
        where: {
          id: payload.timeEntryId,
          orgId,
          employeeId: userId,
          status: 'CLOCKED_IN',
          clockOutAt: null,
        },
      });
    } else if (payload.shiftId) {
      entry = await prisma.timeEntry.findFirst({
        where: {
          shiftId: payload.shiftId,
          orgId,
          employeeId: userId,
          status: 'CLOCKED_IN',
          clockOutAt: null,
        },
        orderBy: { clockInAt: 'desc' },
      });
    } else {
      entry = await prisma.timeEntry.findFirst({
        where: {
          orgId,
          employeeId: userId,
          status: 'CLOCKED_IN',
          clockOutAt: null,
        },
        orderBy: { clockInAt: 'desc' },
      });
    }

    if (!entry) {
      throw new Error('No active clock-in entry found');
    }
    if (now <= entry.clockInAt) {
      throw new Error('Clock-out time must be after clock-in time');
    }

    const needsOvertimeApproval =
      Boolean(entry.scheduledEnd) && now.getTime() > (entry.scheduledEnd as Date).getTime();

    const nextStatus = needsOvertimeApproval ? 'PENDING_OVERTIME_APPROVAL' : 'CLOCKED_OUT';
    const updated = await prisma.timeEntry.update({
      where: { id: entry.id },
      data: {
        clockOutAt: now,
        status: nextStatus,
      },
      include: {
        shift: {
          include: {
            department: true,
            location: true,
          },
        },
      },
    });

    const workedMinutes = calculateWorkedMinutes(entry.clockInAt, now);

    if (needsOvertimeApproval) {
      const [employee, managers] = await Promise.all([
        prisma.user.findFirst({
          where: { id: userId },
          select: { firstName: true, lastName: true },
        }),
        prisma.user.findMany({
          where: {
            orgId,
            isActive: true,
            role: { in: ['ADMIN', 'MANAGER'] },
          },
          select: { id: true },
        }),
      ]);

      const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'An employee';
      await Promise.all(
        managers.map((manager) =>
          NotificationService.createNotification(
            orgId,
            manager.id,
            'Overtime Approval Needed',
            `${employeeName} clocked out after scheduled end and needs approval.`,
            'OVERTIME_APPROVAL',
            updated.id,
            'TIME_ENTRY'
          )
        )
      );
    }

    return {
      ...updated,
      workedMinutes,
      workedHours: asHours(workedMinutes),
      needsOvertimeApproval,
    };
  },

  async getMyWeeklyHours(orgId: string, userId: string, weekStartIso?: string) {
    const now = new Date();
    const weekStart = weekStartIso ? new Date(weekStartIso) : startOfWeekSunday(now);
    if (Number.isNaN(weekStart.getTime())) {
      throw new Error('Invalid weekStart value');
    }
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const [entries, shifts] = await Promise.all([
      prisma.timeEntry.findMany({
        where: {
          orgId,
          employeeId: userId,
          clockInAt: { gte: weekStart, lt: weekEnd },
        },
        include: {
          shift: {
            include: {
              department: true,
              location: true,
            },
          },
        },
        orderBy: { clockInAt: 'asc' },
      }),
      prisma.shift.findMany({
        where: {
          employeeId: userId,
          scheduleWeek: { orgId },
          startTime: { gte: weekStart, lt: weekEnd },
        },
      }),
    ]);

    const actualMinutes = entries.reduce((acc, entry) => {
      if (!entry.clockOutAt) return acc;
      const effectiveClockOutAt =
        entry.status === 'PENDING_OVERTIME_APPROVAL' && entry.scheduledEnd
          ? (entry.scheduledEnd as Date)
          : entry.clockOutAt;
      return acc + calculateWorkedMinutes(entry.clockInAt, effectiveClockOutAt);
    }, 0);

    const scheduledMinutes = shifts.reduce((acc, shift) => {
      const total = Math.max(Math.floor((shift.endTime.getTime() - shift.startTime.getTime()) / (1000 * 60)), 0);
      return acc + Math.max(total - (shift.breakDurationMinutes || 0), 0);
    }, 0);

    return {
      weekStart,
      weekEnd,
      scheduledHours: asHours(scheduledMinutes),
      actualHours: asHours(actualMinutes),
      differenceHours: asHours(actualMinutes - scheduledMinutes),
      lateClockIns: entries.filter((entry) => entry.isLate).length,
      entries,
    };
  },

  async getOrgWeeklyHoursComparison(orgId: string, weekId?: string) {
    let week = null;
    if (weekId) {
      week = await prisma.scheduleWeek.findFirst({
        where: { id: weekId, orgId },
      });
    } else {
      const now = new Date();
      week = await prisma.scheduleWeek.findFirst({
        where: {
          orgId,
          startDate: { lte: now },
          endDate: { gte: now },
        },
      });
    }

    if (!week) {
      throw new Error('Schedule week not found');
    }

    const [shifts, entries] = await Promise.all([
      prisma.shift.findMany({
        where: { scheduleWeekId: week.id },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.timeEntry.findMany({
        where: {
          orgId,
          clockInAt: { gte: week.startDate, lt: week.endDate },
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const scheduledByEmployee = new Map<string, { user: any; minutes: number }>();
    for (const shift of shifts) {
      if (!shift.employeeId || !shift.employee) continue;
      const minutes = Math.max(
        Math.floor((shift.endTime.getTime() - shift.startTime.getTime()) / (1000 * 60)) -
          (shift.breakDurationMinutes || 0),
        0
      );
      const existing = scheduledByEmployee.get(shift.employeeId);
      if (existing) {
        existing.minutes += minutes;
      } else {
        scheduledByEmployee.set(shift.employeeId, { user: shift.employee, minutes });
      }
    }

    const actualByEmployee = new Map<string, { user: any; minutes: number; lateClockIns: number }>();
    for (const entry of entries) {
      if (!entry.employee) continue;
      const effectiveClockOutAt =
        entry.clockOutAt && entry.status === 'PENDING_OVERTIME_APPROVAL' && entry.scheduledEnd
          ? (entry.scheduledEnd as Date)
          : entry.clockOutAt;
      const worked = effectiveClockOutAt ? calculateWorkedMinutes(entry.clockInAt, effectiveClockOutAt) : 0;
      const existing = actualByEmployee.get(entry.employeeId);
      if (existing) {
        existing.minutes += worked;
        if (entry.isLate) existing.lateClockIns += 1;
      } else {
        actualByEmployee.set(entry.employeeId, {
          user: entry.employee,
          minutes: worked,
          lateClockIns: entry.isLate ? 1 : 0,
        });
      }
    }

    const allEmployeeIds = new Set([
      ...scheduledByEmployee.keys(),
      ...actualByEmployee.keys(),
    ]);

    const employees = [...allEmployeeIds].map((employeeId) => {
      const scheduled = scheduledByEmployee.get(employeeId);
      const actual = actualByEmployee.get(employeeId);
      const scheduledMinutes = scheduled?.minutes ?? 0;
      const actualMinutes = actual?.minutes ?? 0;
      const profile = scheduled?.user ?? actual?.user;

      return {
        employeeId,
        employeeName: profile ? `${profile.firstName} ${profile.lastName}` : 'Unknown',
        email: profile?.email ?? '',
        scheduledHours: asHours(scheduledMinutes),
        actualHours: asHours(actualMinutes),
        differenceHours: asHours(actualMinutes - scheduledMinutes),
        completionRatePct:
          scheduledMinutes > 0
            ? Math.round((actualMinutes / scheduledMinutes) * 100)
            : 0,
        lateClockIns: actual?.lateClockIns ?? 0,
      };
    });

    employees.sort((a, b) => b.actualHours - a.actualHours);

    const totalScheduledMinutes = employees.reduce(
      (acc, employee) => acc + Math.round(employee.scheduledHours * 60),
      0
    );
    const totalActualMinutes = employees.reduce(
      (acc, employee) => acc + Math.round(employee.actualHours * 60),
      0
    );

    return {
      weekId: week.id,
      weekStart: week.startDate,
      weekEnd: week.endDate,
      employees,
      totals: {
        scheduledHours: asHours(totalScheduledMinutes),
        actualHours: asHours(totalActualMinutes),
      },
    };
  },

  async getPendingOvertimeRequests(orgId: string) {
    return await prisma.timeEntry.findMany({
      where: {
        orgId,
        status: 'PENDING_OVERTIME_APPROVAL',
        clockOutAt: { not: null },
        scheduledEnd: { not: null },
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        shift: {
          include: {
            department: true,
            location: true,
          },
        },
      },
      orderBy: { clockOutAt: 'desc' },
    });
  },

  async reviewOvertimeRequest(
    orgId: string,
    _approverId: string,
    timeEntryId: string,
    decision: 'APPROVE' | 'DENY'
  ) {
    const entry = await prisma.timeEntry.findFirst({
      where: {
        id: timeEntryId,
        orgId,
        status: 'PENDING_OVERTIME_APPROVAL',
      },
      include: {
        employee: true,
      },
    });

    if (!entry || !entry.clockOutAt || !entry.scheduledEnd) {
      throw new Error('Overtime request not found');
    }

    const updated = await prisma.timeEntry.update({
      where: { id: timeEntryId },
      data:
        decision === 'APPROVE'
          ? { status: 'CLOCKED_OUT' }
          : { status: 'CLOCKED_OUT', clockOutAt: entry.scheduledEnd },
    });

    await NotificationService.createNotification(
      orgId,
      entry.employeeId,
      decision === 'APPROVE' ? 'Overtime Approved' : 'Overtime Denied',
      decision === 'APPROVE'
        ? 'Your late clock-out time was approved.'
        : 'Your late clock-out time was denied and adjusted to scheduled end time.',
      decision === 'APPROVE' ? 'OVERTIME_APPROVED' : 'OVERTIME_DENIED',
      timeEntryId,
      'TIME_ENTRY'
    );

    return updated;
  },
};
