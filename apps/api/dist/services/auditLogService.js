import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export const AuditLogService = {
    async createAuditLog(orgId, userId, action, targetId, targetType, previousValues, newValue, ipAddress) {
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
    async getOrgAuditLogs(orgId, filters) {
        const where = { orgId };
        if (filters?.userId)
            where.userId = filters.userId;
        if (filters?.action)
            where.action = filters.action;
        if (filters?.startDate)
            where.createdAt = { ...where.createdAt, gte: new Date(filters.startDate) };
        if (filters?.endDate)
            where.createdAt = { ...where.createdAt, lte: new Date(filters.endDate) };
        return await prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: filters?.limit || 50,
        });
    },
    async getUserAuditLogs(userId) {
        return await prisma.auditLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    },
    async getAuditLog(logId) {
        return await prisma.auditLog.findUnique({
            where: { id: logId },
        });
    },
};
