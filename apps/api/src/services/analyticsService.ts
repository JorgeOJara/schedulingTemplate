import { PrismaClient } from '@prisma/client';
import { ShiftService } from './shiftService.js';

const prisma = new PrismaClient();

export const AnalyticsService = {
  async getWeeklySummary(orgId: string, weekId?: string) {
    const now = new Date();
    
    let week = null;
    let scheduleWeekId = weekId;

    if (!scheduleWeekId) {
      // Find current week
      week = await prisma.scheduleWeek.findFirst({
        where: {
          orgId,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        orderBy: { startDate: 'desc' },
      });

      if (!week) {
        // Create a new week for current week
        const start = new Date();
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);

        const end = new Date(start);
        end.setDate(start.getDate() + 7);

        week = await prisma.scheduleWeek.create({
          data: {
            orgId,
            startDate: start,
            endDate: end,
            state: 'DRAFT',
          },
        });
      }

      scheduleWeekId = week.id;
    }
    if (!week && scheduleWeekId) {
      week = await prisma.scheduleWeek.findFirst({
        where: { id: scheduleWeekId, orgId },
      });
    }

    const shifts = await prisma.shift.findMany({
      where: { scheduleWeekId: scheduleWeekId },
      include: { 
        employee: true,
        department: true,
        location: true,
      },
    });
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        orgId,
        clockInAt: { gte: week?.startDate ?? new Date(0), lt: week?.endDate ?? new Date() },
      },
    });

    const org = await prisma.organization.findUnique({ where: { id: orgId } });

    if (!org) throw new Error('Organization not found');

    const overtime = ShiftService.calculateOvertime(shifts, org);

    // Count shift types
    const shiftCounts = shifts.reduce((acc, shift) => {
      acc[shift.shiftType] = (acc[shift.shiftType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Count shifts by department
    const departmentShifts = shifts.reduce((acc, shift) => {
      if (shift.departmentId) {
        acc[shift.departmentId] = (acc[shift.departmentId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Count shifts by location
    const locationShifts = shifts.reduce((acc, shift) => {
      if (shift.locationId) {
        acc[shift.locationId] = (acc[shift.locationId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Count unique employees
    const employeesSet = new Set(shifts.map(s => s.employeeId).filter(Boolean));
    const totalEmployees = employeesSet.size;

    // Calculate scheduled hours by employee
    const employeeHours = shifts.reduce((acc, shift) => {
      if (shift.employeeId) {
        const hours = ShiftService.calculateHours([shift], org.timezone).totalHours;
        acc[shift.employeeId] = (acc[shift.employeeId] || 0) + hours;
      }
      return acc;
    }, {} as Record<string, number>);

    // Get top overtime risk employees
    const overtimeRisks = Object.entries(employeeHours)
      .map(([employeeId, hours]) => ({
        employeeId,
        hours,
        isAtRisk: hours > org.weeklyOtcThreshold,
      }))
      .sort((a, b) => Number(b.hours) - Number(a.hours))
      .slice(0, 5);

    // Count pending actions
    const pendingTimeOff = await prisma.timeOffRequest.count({
      where: { orgId, status: 'PENDING' },
    });

    const pendingSwaps = await prisma.shiftSwapRequest.count({
      where: { orgId, status: { in: ['PENDING', 'ACCEPTED'] } },
    });

    const openShifts = shifts.filter(s => !s.employeeId).length;
    const actualWorkedHours = timeEntries.reduce((acc, entry) => {
      if (!entry.clockOutAt) return acc;
      const minutes = Math.max(
        Math.floor((entry.clockOutAt.getTime() - entry.clockInAt.getTime()) / (1000 * 60)),
        0
      );
      return acc + minutes / 60;
    }, 0);
    const lateClockIns = timeEntries.filter((entry) => entry.isLate).length;

    return {
      scheduleWeekId: week?.id || scheduleWeekId,
      scheduleWeekState: week?.state,
      totalShifts: shifts.length,
      totalScheduledHours: overtime.totalHours,
      regularHours: overtime.regularHours,
      overtimeHours: overtime.dailyOvertimeHours + overtime.weeklyOvertimeHours,
      doubleOvertimeHours: overtime.doubleOvertimeHours,
      totalEmployees: totalEmployees,
      scheduledEmployees: employeesSet.size,
      shiftCounts,
      departmentShifts,
      locationShifts,
      overtimeRisks,
      pendingTimeOff,
      pendingSwaps,
      openShifts,
      actualWorkedHours,
      lateClockIns,
    };
  },

  async getDepartmentBreakdown(orgId: string) {
    const departments = await prisma.department.findMany({
      where: { orgId, active: true },
      include: { 
        shifts: { 
          include: { employee: true },
          where: { shiftType: 'REGULAR' },
        },
      },
    });

    return departments.map(dept => {
      const regularHours = dept.shifts.reduce((acc, shift) => {
        const hours = ShiftService.calculateHours([shift], orgId).totalHours;
        return acc + hours;
      }, 0);

      return {
        departmentId: dept.id,
        name: dept.name,
        totalShifts: dept.shifts.length,
        scheduledEmployees: new Set(dept.shifts.map(s => s.employeeId).filter(Boolean)).size,
        regularHours,
      };
    });
  },

  async getCoverageMetrics(orgId: string, weekId?: string) {
    const now = new Date();
    
    let week = null;
    let scheduleWeekId = weekId;

    if (!scheduleWeekId) {
      week = await prisma.scheduleWeek.findFirst({
        where: {
          orgId,
          startDate: { lte: now },
          endDate: { gte: now },
        },
      });
      scheduleWeekId = week?.id;
    }

    if (!scheduleWeekId) {
      return { percentage: 0, coverageCount: 0, requiredCount: 0 };
    }

    const shifts = await prisma.shift.findMany({
      where: { scheduleWeekId },
    });

    const scheduledShifts = shifts.filter(s => s.employeeId).length;
    const totalShifts = shifts.length;
    const percentage = totalShifts > 0 ? (scheduledShifts / totalShifts) * 100 : 0;

    return {
      scheduleWeekId,
      percentage,
      coverageCount: scheduledShifts,
      requiredCount: totalShifts,
    };
  },

  async getOrgStats(orgId: string) {
    const [org, employees, departments, locations] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId } }),
      prisma.user.count({ where: { orgId, role: 'EMPLOYEE', isActive: true } }),
      prisma.department.count({ where: { orgId, active: true } }),
      prisma.location.count({ where: { orgId, active: true } }),
    ]);

    if (!org) throw new Error('Organization not found');

    return {
      orgId,
      orgName: org.name,
      totalEmployees: employees,
      totalDepartments: departments,
      totalLocations: locations,
    };
  },
};
