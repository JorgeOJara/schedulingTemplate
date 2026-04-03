import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const EmployeeGroupService = {
  async getGroups(orgId: string) {
    return await prisma.employeeGroup.findMany({
      where: { orgId },
      include: {
        location: { select: { id: true, name: true, address: true } },
        members: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true },
            },
          },
        },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getGroup(orgId: string, groupId: string) {
    return await prisma.employeeGroup.findFirst({
      where: { id: groupId, orgId },
      include: {
        location: { select: { id: true, name: true, address: true } },
        members: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true },
            },
          },
        },
      },
    });
  },

  async createGroup(orgId: string, name: string, locationId: string) {
    const location = await prisma.location.findFirst({ where: { id: locationId, orgId, active: true } });
    if (!location) {
      throw new Error('Location not found');
    }

    return await prisma.employeeGroup.create({
      data: { name, orgId, locationId },
      include: {
        location: { select: { id: true, name: true, address: true } },
        members: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true },
            },
          },
        },
        _count: { select: { members: true } },
      },
    });
  },

  async updateGroup(orgId: string, groupId: string, name?: string, locationId?: string) {
    const group = await prisma.employeeGroup.findFirst({ where: { id: groupId, orgId } });
    if (!group) {
      throw new Error('Group not found');
    }

    if (locationId) {
      const location = await prisma.location.findFirst({ where: { id: locationId, orgId, active: true } });
      if (!location) {
        throw new Error('Location not found');
      }
    }

    return await prisma.employeeGroup.update({
      where: { id: groupId },
      data: { ...(name !== undefined && { name }), ...(locationId !== undefined && { locationId }) },
      include: {
        location: { select: { id: true, name: true, address: true } },
        members: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true },
            },
          },
        },
        _count: { select: { members: true } },
      },
    });
  },

  async deleteGroup(orgId: string, groupId: string) {
    const group = await prisma.employeeGroup.findFirst({ where: { id: groupId, orgId } });
    if (!group) {
      throw new Error('Group not found');
    }

    await prisma.employeeGroup.delete({ where: { id: groupId } });
  },

  async addMember(orgId: string, groupId: string, userId: string) {
    const group = await prisma.employeeGroup.findFirst({ where: { id: groupId, orgId } });
    if (!group) {
      throw new Error('Group not found');
    }

    const user = await prisma.user.findFirst({ where: { id: userId, orgId, isActive: true } });
    if (!user) {
      throw new Error('Employee not found');
    }

    // Remove from any existing group first (one group per employee)
    await prisma.employeeGroupMember.deleteMany({ where: { userId } });

    // Add to the new group
    await prisma.employeeGroupMember.create({
      data: { groupId, userId },
    });
  },

  async removeMember(orgId: string, groupId: string, userId: string) {
    const group = await prisma.employeeGroup.findFirst({ where: { id: groupId, orgId } });
    if (!group) {
      throw new Error('Group not found');
    }

    await prisma.employeeGroupMember.deleteMany({
      where: { groupId, userId },
    });
  },

  async getEmployeesByLocation(orgId: string, locationId: string) {
    const members = await prisma.employeeGroupMember.findMany({
      where: {
        group: { orgId, locationId },
        user: { isActive: true },
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true },
        },
      },
    });

    // Deduplicate
    const seen = new Set<string>();
    const employees: typeof members[0]['user'][] = [];
    for (const m of members) {
      if (!seen.has(m.user.id)) {
        seen.add(m.user.id);
        employees.push(m.user);
      }
    }

    return employees;
  },
};
