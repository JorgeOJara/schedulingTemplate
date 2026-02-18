import { PrismaClient } from '@prisma/client';
import { ShiftService } from './shiftService.js';
import { AuditLogService } from './auditLogService.js';

const prisma = new PrismaClient();

export interface ShiftSwapCreate {
  orgId: string;
  requestorId: string;
  responderId: string;
  proposedShiftIds: string[];
  requestedShiftIds: string[];
  type: string;
  reason: string;
}

export interface ShiftSwapUpdate {
  status: string;
  approvedById?: string;
  notes?: string;
}

export const ShiftSwapService = {
  async createSwap(data: ShiftSwapCreate) {
    const { orgId, requestorId, responderId, proposedShiftIds, requestedShiftIds, type, reason } = data;

    // Verify both users are in the org
    const requestor = await prisma.user.findUnique({
      where: { id: requestorId },
      include: { org: true },
    });

    const responder = await prisma.user.findUnique({
      where: { id: responderId },
      include: { org: true },
    });

    if (!requestor || requestor.orgId !== orgId) {
      throw new Error('Requestor not in organization');
    }

    if (!responder || responder.orgId !== orgId) {
      throw new Error('Responder not in organization');
    }

    // Verify proposed shifts exist and belong to requestor
    const proposedShifts = await prisma.shift.findMany({
      where: {
        id: { in: proposedShiftIds },
        employeeId: requestorId,
      },
    });

    if (proposedShifts.length !== proposedShiftIds.length) {
      throw new Error('Some proposed shifts not found or not owned by requestor');
    }

    // Verify requested shifts exist and belong to responder
    const requestedShifts = await prisma.shift.findMany({
      where: {
        id: { in: requestedShiftIds },
        employeeId: responderId,
      },
    });

    if (requestedShifts.length !== requestedShiftIds.length) {
      throw new Error('Some requested shifts not found or not owned by responder');
    }

    // Check for conflicts with proposed shifts
    for (const shift of proposedShifts) {
      const hasConflict = await ShiftService.checkShiftConflicts(
        shift.scheduleWeekId,
        responderId,
        shift.startTime.toISOString(),
        shift.endTime.toISOString()
      );

      if (hasConflict) {
        throw new Error(`Shift ${shift.id} conflicts with responder's schedule`);
      }
    }

    // Check for conflicts with requested shifts
    for (const shift of requestedShifts) {
      const hasConflict = await ShiftService.checkShiftConflicts(
        shift.scheduleWeekId,
        requestorId,
        shift.startTime.toISOString(),
        shift.endTime.toISOString()
      );

      if (hasConflict) {
        throw new Error(`Shift ${shift.id} conflicts with requestor's schedule`);
      }
    }

    const swapRequest = await prisma.shiftSwapRequest.create({
      data: {
        orgId,
        requestorId,
        responderId,
        proposedShiftIds: JSON.stringify(proposedShiftIds),
        requestedShiftIds: JSON.stringify(requestedShiftIds),
        type,
        reason,
        status: 'PENDING',
      },
    });

    return swapRequest;
  },

  async updateSwap(swapId: string, orgId: string, data: ShiftSwapUpdate) {
    const { status, approvedById, notes } = data;

    const swap = await prisma.shiftSwapRequest.findUnique({
      where: { id: swapId, orgId },
    });

    if (!swap) {
      throw new Error('Shift swap request not found');
    }

    const oldStatus = swap.status;
    const updatedSwap = await prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        status,
        approvedById: status === 'PENDING' ? null : approvedById || null,
        notes: status === 'PENDING' ? null : notes || null,
      },
    });

    // If approved and accepted, swap the shifts
    if (status === 'APPROVED' && oldStatus === 'ACCEPTED') {
      const proposedShiftIds = JSON.parse(swap.proposedShiftIds);
      const requestedShiftIds = JSON.parse(swap.requestedShiftIds);

      // Perform the shift swap in a transaction
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < proposedShiftIds.length; i++) {
          await tx.shift.update({
            where: { id: proposedShiftIds[i] },
            data: { employeeId: requestedShiftIds[i] },
          });
        }

        for (let i = 0; i < requestedShiftIds.length; i++) {
          await tx.shift.update({
            where: { id: requestedShiftIds[i] },
            data: { employeeId: proposedShiftIds[i] },
          });
        }
      });

      await ShiftService.checkShiftConflicts(
        proposedShiftIds[0],
        requestedShiftIds[0],
        new Date().toISOString(),
        new Date().toISOString()
      );
    }

    if (status === 'APPROVED') {
      await AuditLogService.createAuditLog(
        orgId,
        approvedById,
        'SWAP_APPROVED',
        swapId,
        'ShiftSwapRequest',
        { status: oldStatus },
        updatedSwap
      );
    } else if (status === 'DENIED') {
      await AuditLogService.createAuditLog(
        orgId,
        approvedById,
        'SWAP_REJECTED',
        swapId,
        'ShiftSwapRequest',
        { status: oldStatus },
        updatedSwap
      );
    }

    return updatedSwap;
  },

  async acceptSwap(swapId: string, responderId: string, orgId: string) {
    const swap = await prisma.shiftSwapRequest.findUnique({
      where: { id: swapId, responderId, orgId },
    });

    if (!swap) {
      throw new Error('Shift swap request not found or not for responder');
    }

    if (swap.status !== 'PENDING') {
      throw new Error('Can only accept pending swap requests');
    }

    return await prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: { status: 'ACCEPTED' },
    });
  },

  async denySwap(swapId: string, responderId: string, orgId: string) {
    const swap = await prisma.shiftSwapRequest.findUnique({
      where: { id: swapId, responderId, orgId },
    });

    if (!swap) {
      throw new Error('Shift swap request not found or not for responder');
    }

    return await prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: { status: 'DENIED' },
    });
  },

  async getRequest(swapId: string, orgId: string) {
    return await prisma.shiftSwapRequest.findUnique({
      where: { id: swapId, orgId },
      include: {
        requestor: { include: { employeeProfile: true } },
        responder: { include: { employeeProfile: true } },
      },
    });
  },

  async getOrgSwaps(orgId: string, filters?: {
    status?: string;
    requestorId?: string;
  }) {
    const where: any = { orgId };

    if (filters?.status) where.status = filters.status;
    if (filters?.requestorId) where.requestorId = filters.requestorId;

    return await prisma.shiftSwapRequest.findMany({
      where,
      include: {
        requestor: { include: { employeeProfile: true } },
        responder: { include: { employeeProfile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getMySwaps(userId: string) {
    return await prisma.shiftSwapRequest.findMany({
      where: {
        OR: [{ requestorId: userId }, { responderId: userId }],
      },
      include: {
        requestor: { include: { employeeProfile: true } },
        responder: { include: { employeeProfile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },
};
