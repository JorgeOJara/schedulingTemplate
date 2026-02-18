import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

export const validateCreateOrg = (data: unknown) => {
  const schema = z.object({
    name: z.string().min(1),
    timezone: z.string().min(1),
    dailyOtcThreshold: z.number().int().min(0).max(24).optional(),
    weeklyOtcThreshold: z.number().int().min(0).max(168).optional(),
    minRestBetweenShifts: z.number().int().min(0).optional(),
    maxHoursPerWeek: z.number().int().min(0).optional(),
    clockInEarlyAllowanceMinutes: z.number().int().min(0).max(60).optional(),
    setupCompleted: z.boolean().optional(),
  });
  return schema.parse(data);
};

export const validateUpdateOrg = (data: unknown) => {
  const schema = z.object({
    name: z.string().min(1).optional(),
    timezone: z.string().min(1).optional(),
    dailyOtcThreshold: z.number().int().min(0).max(24).optional(),
    weeklyOtcThreshold: z.number().int().min(0).max(168).optional(),
    minRestBetweenShifts: z.number().int().min(0).optional(),
    maxHoursPerWeek: z.number().int().min(0).optional(),
    clockInEarlyAllowanceMinutes: z.number().int().min(0).max(60).optional(),
    setupCompleted: z.boolean().optional(),
  });
  return schema.parse(data);
};

export const OrgService = {
  async createOrg(data: unknown) {
    const { name, timezone, dailyOtcThreshold, weeklyOtcThreshold, minRestBetweenShifts, maxHoursPerWeek, clockInEarlyAllowanceMinutes, setupCompleted } = validateCreateOrg(data);

    return await prisma.organization.create({
      data: {
        name,
        timezone,
        dailyOtcThreshold: dailyOtcThreshold ?? 8,
        weeklyOtcThreshold: weeklyOtcThreshold ?? 40,
        minRestBetweenShifts: minRestBetweenShifts ?? 8,
        maxHoursPerWeek: maxHoursPerWeek ?? 40,
        clockInEarlyAllowanceMinutes: clockInEarlyAllowanceMinutes ?? 5,
        setupCompleted: setupCompleted ?? false,
      },
    });
  },

  async getOrg(orgId: string) {
    return await prisma.organization.findUnique({
      where: { id: orgId },
    });
  },

  async updateOrg(orgId: string, data: unknown) {
    const { name, timezone, dailyOtcThreshold, weeklyOtcThreshold, minRestBetweenShifts, maxHoursPerWeek, clockInEarlyAllowanceMinutes, setupCompleted } = validateUpdateOrg(data);

    return await prisma.organization.update({
      where: { id: orgId },
      data: {
        name,
        timezone,
        dailyOtcThreshold,
        weeklyOtcThreshold,
        minRestBetweenShifts,
        maxHoursPerWeek,
        clockInEarlyAllowanceMinutes,
        setupCompleted,
      },
    });
  },

  async deleteOrg(orgId: string) {
    return await prisma.organization.delete({
      where: { id: orgId },
    });
  },

  async getEmployees(orgId: string) {
    const employees = await prisma.user.findMany({
      where: { orgId, isActive: true },
      include: { employeeProfile: true },
    });

    return employees.map((employee) => ({
      ...employee,
      active: employee.isActive,
    }));
  },
};
