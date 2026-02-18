import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const EmployeeProfileService = {
  async getProfileByUserId(userId: string) {
    return await prisma.employeeProfile.findUnique({
      where: { userId },
    });
  },

  async getProfile(profileId: string) {
    return await prisma.employeeProfile.findUnique({
      where: { id: profileId },
      include: { user: true },
    });
  },

  async createProfile(data: { 
    userId: string;
    bio?: string;
    phone?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  }) {
    return await prisma.employeeProfile.create({
      data,
    });
  },

  async updateProfile(profileId: string, data: { 
    bio?: string;
    phone?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  }) {
    return await prisma.employeeProfile.update({
      where: { id: profileId },
      data,
    });
  },

  async upsertProfile(userId: string, data: { 
    bio?: string;
    phone?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  }) {
    return await prisma.employeeProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  },
};
