import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export const NotificationService = {
    async createNotification(orgId, userId, title, message, type, relatedId, relatedType) {
        return await prisma.notification.create({
            data: {
                orgId,
                userId,
                title,
                message,
                type,
                isRead: false,
                relatedId,
                relatedType,
            },
        });
    },
    async markAsRead(notificationId, userId) {
        const notification = await prisma.notification.findFirst({
            where: { id: notificationId, userId },
        });
        if (!notification) {
            return null;
        }
        return await prisma.notification.update({
            where: { id: notificationId },
            data: { isRead: true },
        });
    },
    async markAllAsRead(userId) {
        return await prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
    },
    async getNotifications(userId, filters) {
        const where = { userId };
        if (filters?.isRead !== undefined)
            where.isRead = filters.isRead;
        if (filters?.type)
            where.type = filters.type;
        return await prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: filters?.limit || 20,
        });
    },
    async getUnreadCount(userId) {
        return await prisma.notification.count({
            where: { userId, isRead: false },
        });
    },
    async getNotification(notificationId, userId) {
        return await prisma.notification.findFirst({
            where: { id: notificationId, userId },
        });
    },
};
