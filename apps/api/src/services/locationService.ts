import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const LocationService = {
  async createLocation(orgId: string, name: string, address?: string, phone?: string) {
    return await prisma.location.create({
      data: {
        orgId,
        name,
        address,
        phone,
      },
    });
  },

  async updateLocation(orgId: string, id: string, name?: string, address?: string, phone?: string, active?: boolean) {
    const location = await prisma.location.findFirst({ where: { id, orgId } });
    if (!location) {
      throw new Error('Location not found');
    }

    return await prisma.location.update({
      where: { id },
      data: { name, address, phone, active },
    });
  },

  async getLocation(orgId: string, id: string) {
    return await prisma.location.findFirst({
      where: { id, orgId },
      include: { shifts: true, defaultShiftTemplates: true },
    });
  },

  async getLocations(orgId: string, activeOnly = true) {
    return await prisma.location.findMany({
      where: { orgId, active: activeOnly },
    });
  },

  async deleteLocation(orgId: string, id: string) {
    const location = await prisma.location.findFirst({ where: { id, orgId } });
    if (!location) {
      throw new Error('Location not found');
    }

    // Use a transaction to clean up all related data then delete
    await prisma.$transaction(async (tx) => {
      // Delete all shift templates for this location
      await tx.defaultShiftTemplate.deleteMany({ where: { locationId: id, orgId } });

      // Nullify locationId on time entries that reference shifts at this location
      // (TimeEntry.shift has onDelete: SetNull so we handle shifts below)

      // Delete all shifts for this location
      await tx.shift.deleteMany({ where: { locationId: id } });

      // BusinessHours cascade automatically (onDelete: Cascade in schema)

      // Delete the location itself
      await tx.location.delete({ where: { id } });

      // Also clean up any orphan templates (no locationId) for this org
      await tx.defaultShiftTemplate.deleteMany({
        where: { orgId, locationId: null },
      });
    });
  },
};
