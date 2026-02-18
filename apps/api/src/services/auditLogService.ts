import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuditLogData {
  orgId: string;
  actorId?: string | null;
  action: string;
  resourceId?: string | null;
  resourceType?: string | null;
  previousValues?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
}

export const AuditLogService = {
  async createAuditLog(
    orgId: string,
    actorId: string | null,
    action: string,
    resourceId: string | null,
    resourceType: string | null,
    previousValues: any,
    newValue: any,
    ipAddress?: string,
    userAgent?: string
  ) {
    return await prisma.auditLog.create({
      data: {
        orgId,
        actorId,
        action,
        resourceId,
        resourceType,
        previousValues: previousValues ? JSON.stringify(previousValues) : null,
        newValue: newValue ? JSON.stringify(newValue) : null,
        ipAddress,
        userAgent,
      },
    });
  },

  async getOrgAuditLogs(orgId: string, filters?: {
    actorId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    const where: any = { orgId };

    if (filters?.actorId) where.actorId = filters.actorId;
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
      where: { actorId: userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getAuditLog(logId: string) {
    return await prisma.auditLog.findUnique({
      where: { id: logId },
    });
  },
};
