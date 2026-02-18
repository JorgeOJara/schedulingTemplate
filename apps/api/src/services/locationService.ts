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

  async updateLocation(id: string, name?: string, address?: string, phone?: string, active?: boolean) {
    return await prisma.location.update({
      where: { id },
      data: { name, address, phone, active },
    });
  },

  async getLocation(id: string) {
    return await prisma.location.findUnique({
      where: { id },
      include: { shifts: true, shiftTemplates: true },
    });
  },

  async getLocations(orgId: string, activeOnly = true) {
    return await prisma.location.findMany({
      where: { orgId, active: activeOnly },
    });
  },

  async deleteLocation(id: string) {
    return await prisma.location.delete({
      where: { id },
    });
  },
};
