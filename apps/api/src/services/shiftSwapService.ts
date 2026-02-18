import { PrismaClient } from '@prisma/client';
import { AuditLogService } from './auditLogService.js';
import { NotificationService } from './notificationService.js';

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
    if (!responderId) {
      throw new Error('Responder is required');
    }
    if (!Array.isArray(proposedShiftIds) || proposedShiftIds.length === 0) {
      throw new Error('At least one of your shifts must be selected');
    }
    if (!Array.isArray(requestedShiftIds) || requestedShiftIds.length === 0) {
      throw new Error('At least one coworker shift must be selected');
    }
    if (proposedShiftIds.length !== requestedShiftIds.length) {
      throw new Error('Swap requests must pair one of your shifts with one coworker shift');
    }

    if (requestorId === responderId) {
      throw new Error('You cannot request a swap with yourself');
    }

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

    if (requestor.role !== responder.role) {
      throw new Error('Shift swaps are only allowed between employees with the same role');
    }

    if (!['EMPLOYEE', 'MANAGER'].includes(requestor.role)) {
      throw new Error('Shift swaps are only allowed for employee and manager roles');
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

    await NotificationService.createNotification(
      orgId,
      responderId,
      'Shift Swap Requested',
      `${requestor.firstName} ${requestor.lastName} requested to swap shifts with you.`,
      'SHIFT_SWAP_REQUEST',
      swapRequest.id,
      'SHIFT_SWAP_REQUEST'
    );

    return swapRequest;
  },

  async updateSwap(swapId: string, orgId: string, data: ShiftSwapUpdate) {
    const { status, approvedById, notes } = data;

    const swap = await prisma.shiftSwapRequest.findFirst({
      where: { id: swapId, orgId },
      include: {
        requestor: true,
        responder: true,
      },
    });

    if (!swap) {
      throw new Error('Shift swap request not found');
    }

    const oldStatus = swap.status;
    if (status === 'APPROVED' && oldStatus !== 'ACCEPTED') {
      throw new Error('Swap must be accepted by the responder before final approval');
    }

    const updatedSwap = await prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        status,
        approvedById: status === 'PENDING' ? null : approvedById || null,
        notes: status === 'PENDING' ? null : notes || null,
      },
    });

    // If approved, swap the shifts.
    if (status === 'APPROVED') {
      const proposedShiftIds = JSON.parse(swap.proposedShiftIds) as string[];
      const requestedShiftIds = JSON.parse(swap.requestedShiftIds ?? '[]') as string[];
      if (proposedShiftIds.length !== requestedShiftIds.length || proposedShiftIds.length === 0) {
        throw new Error('Swap request has invalid shift pairs');
      }

      // Perform the shift swap in a transaction
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < proposedShiftIds.length; i++) {
          await tx.shift.update({
            where: { id: proposedShiftIds[i] },
            data: { employeeId: swap.responderId },
          });
        }

        for (let i = 0; i < requestedShiftIds.length; i++) {
          await tx.shift.update({
            where: { id: requestedShiftIds[i] },
            data: { employeeId: swap.requestorId },
          });
        }
      });
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

    if (status === 'APPROVED' || status === 'DENIED') {
      const title = status === 'APPROVED' ? 'Shift Swap Approved' : 'Shift Swap Denied';
      const message =
        status === 'APPROVED'
          ? 'Your shift swap request has been approved.'
          : 'Your shift swap request was denied by management.';
      const type = status === 'APPROVED' ? 'SHIFT_SWAP_APPROVED' : 'SHIFT_SWAP_DENIED';

      await Promise.all([
        NotificationService.createNotification(orgId, swap.requestorId, title, message, type, swapId, 'SHIFT_SWAP_REQUEST'),
        swap.responderId
          ? NotificationService.createNotification(orgId, swap.responderId, title, message, type, swapId, 'SHIFT_SWAP_REQUEST')
          : Promise.resolve(null),
      ]);
    }

    return updatedSwap;
  },

  async acceptSwap(swapId: string, responderId: string, orgId: string) {
    const swap = await prisma.shiftSwapRequest.findFirst({
      where: { id: swapId, responderId, orgId },
      include: { requestor: true },
    });

    if (!swap) {
      throw new Error('Shift swap request not found or not for responder');
    }

    if (swap.status !== 'PENDING') {
      throw new Error('Can only accept pending swap requests');
    }

    const updatedSwap = await prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: { status: 'ACCEPTED' },
    });

    const reviewers = await prisma.user.findMany({
      where: {
        orgId,
        role: { in: ['ADMIN', 'MANAGER'] },
        isActive: true,
      },
      select: { id: true },
    });

    await Promise.all([
      NotificationService.createNotification(
        orgId,
        swap.requestorId,
        'Shift Swap Accepted by Coworker',
        'Your coworker accepted the swap. It is now awaiting manager approval.',
        'SHIFT_SWAP_ACCEPTED',
        swapId,
        'SHIFT_SWAP_REQUEST'
      ),
      ...reviewers.map((reviewer) =>
        NotificationService.createNotification(
          orgId,
          reviewer.id,
          'Shift Swap Awaiting Approval',
          `${swap.requestor.firstName} has a shift swap ready for manager review.`,
          'SHIFT_SWAP_REVIEW',
          swapId,
          'SHIFT_SWAP_REQUEST'
        )
      ),
    ]);

    return updatedSwap;
  },

  async denySwap(swapId: string, responderId: string, orgId: string) {
    const swap = await prisma.shiftSwapRequest.findFirst({
      where: { id: swapId, responderId, orgId },
    });

    if (!swap) {
      throw new Error('Shift swap request not found or not for responder');
    }

    const updatedSwap = await prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: { status: 'DENIED' },
    });

    await NotificationService.createNotification(
      orgId,
      swap.requestorId,
      'Shift Swap Declined',
      'Your coworker declined this shift swap request.',
      'SHIFT_SWAP_DECLINED',
      swapId,
      'SHIFT_SWAP_REQUEST'
    );

    return updatedSwap;
  },

  async getRequest(swapId: string, orgId: string) {
    const swap = await prisma.shiftSwapRequest.findFirst({
      where: { id: swapId, orgId },
      include: {
        requestor: { include: { employeeProfile: true } },
        responder: { include: { employeeProfile: true } },
      },
    });

    if (!swap) {
      return null;
    }

    return {
      ...swap,
      proposedShiftIds: JSON.parse(swap.proposedShiftIds),
      requestedShiftIds: JSON.parse(swap.requestedShiftIds ?? '[]'),
    };
  },

  async getOrgSwaps(orgId: string, filters?: {
    status?: string;
    requestorId?: string;
  }) {
    const where: any = { orgId };

    if (filters?.status) where.status = filters.status;
    if (filters?.requestorId) where.requestorId = filters.requestorId;

    const swaps = await prisma.shiftSwapRequest.findMany({
      where,
      include: {
        requestor: { include: { employeeProfile: true } },
        responder: { include: { employeeProfile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return swaps.map((swap) => ({
      ...swap,
      proposedShiftIds: JSON.parse(swap.proposedShiftIds),
      requestedShiftIds: JSON.parse(swap.requestedShiftIds ?? '[]'),
    }));
  },

  async getMySwaps(userId: string) {
    const swaps = await prisma.shiftSwapRequest.findMany({
      where: {
        OR: [{ requestorId: userId }, { responderId: userId }],
      },
      include: {
        requestor: { include: { employeeProfile: true } },
        responder: { include: { employeeProfile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return swaps.map((swap) => ({
      ...swap,
      proposedShiftIds: JSON.parse(swap.proposedShiftIds),
      requestedShiftIds: JSON.parse(swap.requestedShiftIds ?? '[]'),
    }));
  },
};
