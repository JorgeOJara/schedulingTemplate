import { PrismaClient } from '@prisma/client';
import { DateTime, Duration, IANAZone } from 'luxon';
import { logger } from '../config/logger.js';

const prisma = new PrismaClient();

export interface ShiftCreateData {
  scheduleWeekId: string;
  employeeId?: string | null;
  departmentId?: string | null;
  locationId?: string | null;
  shiftGroup?: string;
  startTime: string;
  endTime: string;
  breakDurationMinutes?: number;
  breakIsPaid?: boolean;
  notes?: string;
}

export interface ShiftUpdateData {
  employeeId?: string | null;
  departmentId?: string | null;
  locationId?: string | null;
  shiftGroup?: string;
  startTime?: string;
  endTime?: string;
  breakDurationMinutes?: number;
  breakIsPaid?: boolean;
  notes?: string;
}

export const ShiftService = {
  async createShift(orgId: string, data: ShiftCreateData) {
    const {
      scheduleWeekId,
      employeeId,
      departmentId,
      locationId,
      shiftGroup,
      startTime,
      endTime,
      breakDurationMinutes = 0,
      breakIsPaid = false,
      notes,
    } = data;

    // Validate org exists
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      throw new Error('Organization not found');
    }

    // Check overlaps only for assigned employees; open slots can coexist by timeframe.
    if (employeeId) {
      const existingOverlap = await prisma.shift.findFirst({
        where: {
          scheduleWeekId,
          employeeId,
          OR: [
            {
              startTime: { lte: endTime },
              endTime: { gte: startTime },
            },
          ],
        },
      });

      if (existingOverlap) {
        throw new Error('Shift overlaps with existing shift for this employee');
      }
    }

    // Check employee availability (if configured)
    if (employeeId) {
      const user = await prisma.user.findUnique({
        where: { id: employeeId },
        include: { org: true },
      });

      if (!user) {
        throw new Error('Employee not found');
      }

      if (!user.isActive) {
        throw new Error('Employee account is deactivated');
      }

      if (user.orgId !== orgId) {
        throw new Error('Employee does not belong to this organization');
      }
    }

    return await prisma.shift.create({
      data: {
        scheduleWeekId,
        employeeId,
        departmentId,
        locationId,
        shiftGroup,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        breakDurationMinutes,
        breakIsPaid,
        notes,
      },
    });
  },

  async updateShift(shiftId: string, orgId: string, data: ShiftUpdateData) {
    // Get current shift
    const currentShift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        scheduleWeek: true,
      },
    });

    if (!currentShift || currentShift.scheduleWeek.orgId !== orgId) {
      throw new Error('Shift not found or access denied');
    }

    // Check for overlaps with other shifts
    if (data.employeeId && (data.startTime || data.endTime)) {
      const existingOverlap = await prisma.shift.findFirst({
        where: {
          scheduleWeekId: currentShift.scheduleWeekId,
          employeeId: data.employeeId,
          NOT: { id: shiftId },
          OR: [
            {
              startTime: { lte: data.endTime || currentShift.endTime },
              endTime: { gte: data.startTime || currentShift.startTime },
            },
          ],
        },
      });

      if (existingOverlap) {
        throw new Error('Shift overlaps with existing shift');
      }
    }

    return await prisma.shift.update({
      where: { id: shiftId },
      data,
      include: {
        employee: true,
        department: true,
        location: true,
      },
    });
  },

  async deleteShift(shiftId: string, orgId: string) {
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: { scheduleWeek: true },
    });

    if (!shift || shift.scheduleWeek.orgId !== orgId) {
      throw new Error('Shift not found or access denied');
    }

    return await prisma.shift.delete({
      where: { id: shiftId },
    });
  },

  async getShift(shiftId: string, orgId: string) {
    return await prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        employee: true,
        department: true,
        location: true,
        scheduleWeek: true,
      },
    });
  },

  async getShiftsByWeek(weekId: string, orgId: string, filters?: {
    departmentId?: string;
    locationId?: string;
    employeeId?: string;
  }) {
    const where: any = {
      scheduleWeekId: weekId,
      scheduleWeek: { orgId },
    };

    if (filters?.departmentId) where.departmentId = filters.departmentId;
    if (filters?.locationId) where.locationId = filters.locationId;
    if (filters?.employeeId) where.employeeId = filters.employeeId;

    return await prisma.shift.findMany({
      where,
      include: {
        employee: true,
        department: true,
        location: true,
      },
      orderBy: { startTime: 'asc' },
    });
  },

  async getShiftsByEmployee(orgId: string, userId: string, startDate: string, endDate: string) {
    return await prisma.shift.findMany({
      where: {
        employeeId: userId,
        scheduleWeek: { orgId },
        OR: [
          {
            startTime: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          },
          {
            endTime: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          },
          {
            AND: [
              { startTime: { lte: new Date(startDate) } },
              { endTime: { gte: new Date(endDate) } },
            ],
          },
        ],
      },
      include: {
        department: true,
        location: true,
      },
      orderBy: { startTime: 'asc' },
    });
  },

  calculateHours(shifts: any[], orgTimezone: string) {
    let totalSeconds = 0;
    let breakMinutes = 0;

    for (const shift of shifts) {
      const start = DateTime.fromISO(shift.startTime.toISOString(), { zone: orgTimezone });
      const end = DateTime.fromISO(shift.endTime.toISOString(), { zone: orgTimezone });

      // Handle overnight shifts
      let duration = end.diff(start, ['hours', 'minutes']);
      let hours = duration.hours + duration.minutes / 60;

      // Subtract break time
      breakMinutes += shift.breakDurationMinutes || 0;

      totalSeconds += hours * 3600;
    }

    const totalHours = totalSeconds / 3600;
    const breakHours = breakMinutes / 60;

    return {
      totalHours,
      breakMinutes,
      breakHours,
    };
  },

  calculateOvertime(shifts: any[], org: any) {
    const { timezone } = org;
    
    // Group shifts by day
    const dailyShifts: Record<string, any[]> = {};
    
    for (const shift of shifts) {
      const start = DateTime.fromISO(shift.startTime.toISOString(), { zone: timezone });
      const dayKey = start.toFormat('yyyy-LL-dd');
      
      if (!dailyShifts[dayKey]) {
        dailyShifts[dayKey] = [];
      }
      dailyShifts[dayKey].push(shift);
    }

    let dailyOvertimeHours = 0;
    let weeklyOvertimeHours = 0;
    let doubleOvertimeHours = 0;

    // Calculate daily overtime
    for (const day in dailyShifts) {
      const dayShifts = dailyShifts[day];
      const { totalHours } = this.calculateHours(dayShifts, timezone);
      
      if (totalHours > org.dailyOtcThreshold) {
        dailyOvertimeHours += totalHours - org.dailyOtcThreshold;
      }
    }

    // Calculate weekly overtime
    const { totalHours } = this.calculateHours(shifts, timezone);
    if (totalHours > org.weeklyOtcThreshold) {
      weeklyOvertimeHours += totalHours - org.weeklyOtcThreshold;
    }

    // Calculate double overtime (optional - could be based on extremely long shifts)
    if (totalHours > org.weeklyOtcThreshold * 2) {
      doubleOvertimeHours = totalHours - org.weeklyOtcThreshold * 2;
    }

    return {
      regularHours: totalHours - dailyOvertimeHours - weeklyOvertimeHours - doubleOvertimeHours,
      dailyOvertimeHours,
      weeklyOvertimeHours,
      doubleOvertimeHours,
      totalHours,
    };
  },

  async checkShiftConflicts(weekId: string, employeeId: string, startTime: string, endTime: string, excludeShiftId?: string) {
    const where: any = {
      scheduleWeekId: weekId,
      employeeId,
      OR: [
        {
          startTime: { lte: new Date(endTime) },
          endTime: { gte: new Date(startTime) },
        },
      ],
    };

    if (excludeShiftId) {
      where.id = { not: excludeShiftId };
    }

    const overlaps = await prisma.shift.findMany({
      where,
    });

    return overlaps.length > 0;
  },
};
