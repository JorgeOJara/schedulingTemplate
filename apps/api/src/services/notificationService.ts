import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const NotificationService = {
  async createNotification(
    orgId: string,
    userId: string,
    title: string,
    message: string,
    type: string,
    relatedId?: string | null,
    relatedType?: string | null
  ) {
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

  async markAsRead(notificationId: string, userId: string) {
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

  async markAllAsRead(userId: string) {
    return await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  },

  async getNotifications(
    userId: string,
    filters?: {
      isRead?: boolean;
      type?: string;
      limit?: number;
    }
  ) {
    const where: any = { userId };

    if (filters?.isRead !== undefined) where.isRead = filters.isRead;
    if (filters?.type) where.type = filters.type;

    return await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 20,
    });
  },

  async getUnreadCount(userId: string) {
    return await prisma.notification.count({
      where: { userId, isRead: false },
    });
  },

  async getNotification(notificationId: string, userId: string) {
    return await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
  },
};
