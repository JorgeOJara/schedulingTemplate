import { PrismaClient } from '@prisma/client';
import { hashPassword } from './authService.js';
const prisma = new PrismaClient();
export const UserService = {
    async getUserById(id) {
        return await prisma.user.findUnique({
            where: { id },
            include: {
                employeeProfile: true,
                org: true,
            },
        });
    },
    async getUserByEmail(email) {
        return await prisma.user.findUnique({
            where: { email },
            include: { org: true },
        });
    },
    async updateUser(id, data) {
        return await prisma.user.update({
            where: { id },
            data,
            include: { org: true, employeeProfile: true },
        });
    },
    async deactivateUser(id) {
        return await prisma.user.update({
            where: { id },
            data: { isActive: false },
        });
    },
    async reactivateUser(id) {
        return await prisma.user.update({
            where: { id },
            data: { isActive: true },
        });
    },
    async deleteUsers(orgId, userIds) {
        return await prisma.user.deleteMany({
            where: { orgId, id: { in: userIds } },
        });
    },
    async createEmployeeProfile(userId, data) {
        return await prisma.employeeProfile.create({
            data: { userId, ...data },
        });
    },
    async updateEmployeeProfile(profileId, data) {
        return await prisma.employeeProfile.update({
            where: { id: profileId },
            data,
        });
    },
    async setUserPassword(userId, password) {
        const passwordHash = await hashPassword(password);
        return await prisma.user.update({
            where: { id: userId },
            data: { passwordHash },
        });
    },
    async getOrgUsers(orgId) {
        return await prisma.user.findMany({
            where: { orgId },
            include: { employeeProfile: true },
            orderBy: { createdAt: 'desc' },
        });
    },
    async getPeersByRole(orgId, role, excludeUserId) {
        return await prisma.user.findMany({
            where: {
                orgId,
                role,
                isActive: true,
                ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
            },
            orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        });
    },
};
