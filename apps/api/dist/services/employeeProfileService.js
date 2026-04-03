import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export const EmployeeProfileService = {
    async getProfileByUserId(userId) {
        return await prisma.employeeProfile.findUnique({
            where: { userId },
        });
    },
    async getProfile(profileId) {
        return await prisma.employeeProfile.findUnique({
            where: { id: profileId },
            include: { user: true },
        });
    },
    async createProfile(data) {
        return await prisma.employeeProfile.create({
            data,
        });
    },
    async updateProfile(profileId, data) {
        return await prisma.employeeProfile.update({
            where: { id: profileId },
            data,
        });
    },
    async upsertProfile(userId, data) {
        return await prisma.employeeProfile.upsert({
            where: { userId },
            create: { userId, ...data },
            update: data,
        });
    },
};
