import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';
import { ShiftService } from './shiftService.js';
import { AuditLogService } from './auditLogService.js';

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

    // Check for overlapping scheduled shifts
    const shifts = await ShiftService.getShiftsByEmployee(orgId, employeeId, startDate, endDate);
    const hasConflicts = shifts.length > 0;

    if (hasConflicts) {
      throw new Error('Time-off request conflicts with scheduled shifts');
    }

    return await prisma.timeOffRequest.create({
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
  },

  async updateRequest(requestId: string, orgId: string, data: TimeOffRequestUpdate) {
    const { status, approvedById, notes } = data;

    const request = await prisma.timeOffRequest.findUnique({
      where: {	id: requestId, orgId },
    });

    if (!request) {
      throw new Error('Time-off request not found');
    }

    if (status === 'APPROVED' && request.status === 'PENDING') {
      // Check for shift conflicts
      const shifts = await ShiftService.getShiftsByEmployee(
        orgId,
        request.employeeId,
        request.startDate.toISOString(),
        request.endDate.toISOString()
      );

      if (shifts.length > 0) {
        throw new Error('Cannot approve: conflicts with scheduled shifts');
      }
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

    return updatedRequest;
  },

  async getRequest(requestId: string, orgId: string) {
    return await prisma.timeOffRequest.findUnique({
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
    const request = await prisma.timeOffRequest.findUnique({
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
