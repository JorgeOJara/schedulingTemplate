import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuditLogData {
  orgId: string;
  userId?: string | null;
  action: string;
  targetId?: string | null;
  targetType?: string | null;
  details?: any;
  ipAddress?: string;
}

export const AuditLogService = {
  async createAuditLog(
    orgId: string,
    userId: string | null,
    action: string,
    targetId: string | null,
    targetType: string | null,
    previousValues: any,
    newValue: any,
    ipAddress?: string
  ) {
    return await prisma.auditLog.create({
      data: {
        orgId,
        userId,
        action,
        targetId,
        targetType: targetType ?? 'UNKNOWN',
        details: JSON.stringify({
          previousValues: previousValues ?? null,
          newValue: newValue ?? null,
        }),
        ipAddress,
      },
    });
  },

  async getOrgAuditLogs(orgId: string, filters?: {
    userId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    const where: any = { orgId };

    if (filters?.userId) where.userId = filters.userId;
    if (filters?.action) where.action = filters.action;
    if (filters?.startDate) where.createdAt = { ...where.createdAt, gte: new Date(filters.startDate) };
    if (filters?.endDate) where.createdAt = { ...where.createdAt, lte: new Date(filters.endDate) };

    return await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
    });
  },

  async getUserAuditLogs(userId: string) {
    return await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getAuditLog(logId: string) {
    return await prisma.auditLog.findUnique({
      where: { id: logId },
    });
  },
};
