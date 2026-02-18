import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const DepartmentService = {
  async createDepartment(orgId: string, name: string, description?: string) {
    return await prisma.department.create({
      data: {
        orgId,
        name,
        description,
      },
    });
  },

  async updateDepartment(id: string, name?: string, description?: string, active?: boolean) {
    return await prisma.department.update({
      where: { id },
      data: { name, description, active },
    });
  },

  async getDepartment(id: string) {
    return await prisma.department.findUnique({
      where: { id },
      include: { shifts: true, shiftTemplates: true },
    });
  },

  async getDepartments(orgId: string, activeOnly = true) {
    return await prisma.department.findMany({
      where: { orgId, active: activeOnly },
    });
  },

  async deleteDepartment(id: string) {
    return await prisma.department.delete({
      where: { id },
    });
  },
};
