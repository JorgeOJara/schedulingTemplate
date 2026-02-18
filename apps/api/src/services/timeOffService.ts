import { PrismaClient } from '@prisma/client';
import { AuditLogService } from './auditLogService.js';
import { NotificationService } from './notificationService.js';

const prisma = new PrismaClient();

export interface TimeOffRequestCreate {
  orgId: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  type: string;
  reason: string;
}

export interface TimeOffRequestUpdate {
  status: string;
  approvedById?: string;
  notes?: string;
}

export const TimeOffService = {
  async createRequest(data: TimeOffRequestCreate) {
    const { orgId, employeeId, startDate, endDate, type, reason } = data;

    // Check if employee belongs to org
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      include: { org: true },
    });

    if (!employee || employee.orgId !== orgId) {
      throw new Error('Employee does not belong to this organization');
    }

    // Check for overlapping existing requests
    const existingRequest = await prisma.timeOffRequest.findFirst({
      where: {
        employeeId,
        status: { not: 'DENIED' },
        OR: [
          {
            startDate: { lte: new Date(endDate) },
            endDate: { gte: new Date(startDate) },
          },
        ],
      },
    });

    if (existingRequest) {
      throw new Error('Overlapping time-off request already exists');
    }

    const createdRequest = await prisma.timeOffRequest.create({
      data: {
        orgId,
        employeeId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        type,
        reason,
        status: 'PENDING',
      },
    });

    const reviewers = await prisma.user.findMany({
      where: {
        orgId,
        role: { in: ['ADMIN', 'MANAGER'] },
        isActive: true,
      },
      select: { id: true, firstName: true, lastName: true },
    });

    await Promise.all(
      reviewers.map((reviewer) =>
        NotificationService.createNotification(
          orgId,
          reviewer.id,
          'Time-Off Request Submitted',
          `${employee.firstName} ${employee.lastName} submitted a time-off request.`,
          'TIME_OFF_REQUEST',
          createdRequest.id,
          'TIME_OFF_REQUEST'
        )
      )
    );

    return createdRequest;
  },

  async updateRequest(requestId: string, orgId: string, data: TimeOffRequestUpdate) {
    const { status, approvedById, notes } = data;

    const request = await prisma.timeOffRequest.findFirst({
      where: { id: requestId, orgId },
    });

    if (!request) {
      throw new Error('Time-off request not found');
    }

    const updatedRequest = await prisma.timeOffRequest.update({
      where: { id: requestId },
      data: {
        status,
        approvedById: status === 'PENDING' ? null : approvedById || null,
        notes: status === 'PENDING' ? null : notes || null,
      },
    });

    if (status === 'APPROVED') {
      await AuditLogService.createAuditLog(
        orgId,
        approvedById,
        'TIME_OFF_APPROVED',
        requestId,
        'TimeOffRequest',
        { status: 'PENDING' },
        updatedRequest
      );
    } else if (status === 'DENIED') {
      await AuditLogService.createAuditLog(
        orgId,
        approvedById,
        'TIME_OFF_DENIED',
        requestId,
        'TimeOffRequest',
        { status: 'PENDING' },
        updatedRequest
      );
    }

    if (status === 'APPROVED' || status === 'DENIED') {
      await NotificationService.createNotification(
        orgId,
        request.employeeId,
        status === 'APPROVED' ? 'Time-Off Request Approved' : 'Time-Off Request Denied',
        status === 'APPROVED'
          ? 'Your time-off request has been approved.'
          : 'Your time-off request was denied.',
        status === 'APPROVED' ? 'TIME_OFF_APPROVED' : 'TIME_OFF_DENIED',
        requestId,
        'TIME_OFF_REQUEST'
      );
    }

    return updatedRequest;
  },

  async getRequest(requestId: string, orgId: string) {
    return await prisma.timeOffRequest.findFirst({
      where: { id: requestId, orgId },
      include: {
        employee: { include: { employeeProfile: true } },
        org: true,
      },
    });
  },

  async getRequests(orgId: string, filters?: {
    status?: string;
    employeeId?: string;
  }) {
    const where: any = { orgId };

    if (filters?.status) where.status = filters.status;
    if (filters?.employeeId) where.employeeId = filters.employeeId;

    return await prisma.timeOffRequest.findMany({
      where,
      include: {
        employee: { include: { employeeProfile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async deleteRequest(requestId: string, orgId: string) {
    const request = await prisma.timeOffRequest.findFirst({
      where: { id: requestId, orgId },
    });

    if (!request) {
      throw new Error('Time-off request not found');
    }

    if (request.status !== 'PENDING') {
      throw new Error('Can only delete pending requests');
    }

    return await prisma.timeOffRequest.delete({
      where: { id: requestId },
    });
  },

  async getUserRequests(userId: string) {
    return await prisma.timeOffRequest.findMany({
      where: { employeeId: userId },
      include: { org: true },
      orderBy: { startDate: 'asc' },
    });
  },
};
