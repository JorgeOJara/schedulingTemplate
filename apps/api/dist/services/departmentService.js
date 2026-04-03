import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export const DepartmentService = {
    async createDepartment(orgId, name, description) {
        return await prisma.department.create({
            data: {
                orgId,
                name,
                description,
            },
        });
    },
    async updateDepartment(id, name, description, active) {
        return await prisma.department.update({
            where: { id },
            data: { name, description, active },
        });
    },
    async getDepartment(id) {
        return await prisma.department.findUnique({
            where: { id },
            include: { shifts: true, defaultShiftTemplates: true },
        });
    },
    async getDepartments(orgId, activeOnly = true) {
        return await prisma.department.findMany({
            where: { orgId, active: activeOnly },
        });
    },
    async deleteDepartment(id) {
        return await prisma.department.delete({
            where: { id },
        });
    },
};
