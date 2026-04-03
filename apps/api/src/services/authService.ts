import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { logger } from '../config/logger.js';
import { NotificationService } from './notificationService.js';
import {
  signAccessToken,
  signInviteToken,
  signPasswordResetToken,
  signRefreshToken,
  verifyAccessToken,
  verifyInviteToken,
  verifyPasswordResetToken,
  verifyRefreshToken,
} from '../utils/authTokens.js';

const prisma = new PrismaClient();

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const emailSchema = z.string().trim().email().transform((email) => email.toLowerCase());
const nameSchema = z.string().trim().min(1);
const passwordSchema = z.string().min(8);
const organizationNameSchema = z.string().trim().min(2);

export const validateLogin = (data: unknown): LoginCredentials => {
  const schema = z.object({
    email: emailSchema,
    password: passwordSchema,
  });

  const parsed = schema.parse(data);
  return { email: parsed.email, password: parsed.password };
};

export const validateRegister = (data: unknown) => {
  const schema = z.object({
    orgId: z.string().uuid(),
    email: emailSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    password: passwordSchema,
    role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']).optional(),
  });
  return schema.parse(data);
};

export const validateOwnerRegistration = (data: unknown) => {
  const schema = z.object({
    email: emailSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    password: passwordSchema,
    organizationName: organizationNameSchema,
    timezone: z.string().default('America/New_York'),
  });

  return schema.parse(data);
};

export const validateEmployeeJoinRegistration = (data: unknown) => {
  const schema = z.object({
    email: emailSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    password: passwordSchema,
    organizationName: organizationNameSchema,
  });

  return schema.parse(data);
};

export const validateInvite = (data: unknown) => {
  const schema = z.object({
    orgId: z.string().uuid(),
    email: emailSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']),
  });
  return schema.parse(data);
};

export const validatePasswordReset = (data: unknown) => {
  const schema = z.object({
    token: z.string().min(1),
    password: passwordSchema,
  });
  return schema.parse(data);
};

export const validateForgotPassword = (data: unknown) => {
  return z.object({ email: emailSchema }).parse(data);
};

export const validateAcceptInvite = (data: unknown) => {
  return z.object({ token: z.string().min(1), password: passwordSchema }).parse(data);
};

export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 10);
};

export const verifyPassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

export const createTokens = (userId: string, orgId: string, role: string): AuthTokens => {
  const accessToken = signAccessToken(userId, orgId, role);
  const refreshToken = signRefreshToken(userId);
  return { accessToken, refreshToken };
};

export const verifyToken = (token: string): { userId: string; orgId: string; role: string } | null => {
  return verifyAccessToken(token);
};

const sanitizeUser = (user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  orgId: string;
}): {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  orgId: string;
} => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  orgId: user.orgId,
});

export const AuthService = {
  async login(credentials: LoginCredentials): Promise<{ user: ReturnType<typeof sanitizeUser>; tokens: AuthTokens } | null> {
    const { email, password } = validateLogin(credentials);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { org: true },
    });

    if (!user || !user.isActive) {
      logger.info(`Login failed for email: ${email}`);
      return null;
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      logger.info(`Invalid password for email: ${email}`);
      return null;
    }

    const tokens = createTokens(user.id, user.orgId, user.role);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return { user: sanitizeUser(user), tokens };
  },

  async register(data: unknown): Promise<{ user: ReturnType<typeof sanitizeUser>; tokens: AuthTokens } | null> {
    const { orgId, email, firstName, lastName, password, role = 'EMPLOYEE' } = validateRegister(data);

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return null;
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        passwordHash,
        role,
        orgId,
        isActive: true,
        emailVerified: false,
      },
      include: { org: true },
    });

    const tokens = createTokens(user.id, user.orgId, user.role);

    return { user: sanitizeUser(user), tokens };
  },

  async registerOwner(data: unknown): Promise<{ user: ReturnType<typeof sanitizeUser>; tokens: AuthTokens } | null> {
    const { email, firstName, lastName, password, organizationName, timezone } = validateOwnerRegistration(data);

    const [existingUser, existingOrg] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.organization.findUnique({ where: { name: organizationName } }),
    ]);

    if (existingUser || existingOrg) {
      return null;
    }

    const passwordHash = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: organizationName,
          timezone,
        },
      });

      const user = await tx.user.create({
        data: {
          email,
          firstName,
          lastName,
          passwordHash,
          role: 'ADMIN',
          orgId: org.id,
          isActive: true,
          emailVerified: true,
        },
        include: { org: true },
      });

      return user;
    });

    const tokens = createTokens(result.id, result.orgId, result.role);
    return { user: sanitizeUser(result), tokens };
  },

  async registerEmployeeJoin(data: unknown): Promise<{ pendingUserId: string; orgId: string } | null> {
    const { email, firstName, lastName, password, organizationName } = validateEmployeeJoinRegistration(data);

    const [existingUser, org] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.organization.findFirst({ where: { name: organizationName } }),
    ]);

    if (existingUser || !org) {
      return null;
    }

    const passwordHash = await hashPassword(password);

    const pendingUser = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        passwordHash,
        role: 'EMPLOYEE',
        orgId: org.id,
        isActive: false,
        emailVerified: false,
      },
    });

    const admins = await prisma.user.findMany({
      where: {
        orgId: org.id,
        role: { in: ['ADMIN', 'MANAGER'] },
        isActive: true,
      },
      select: { id: true },
    });

    await Promise.all(
      admins.map((admin) =>
        NotificationService.createNotification(
          org.id,
          admin.id,
          'New Employee Join Request',
          `${firstName} ${lastName} requested to join ${org.name}.`,
          'JOIN_REQUEST',
          pendingUser.id,
          'USER'
        )
      )
    );

    return { pendingUserId: pendingUser.id, orgId: org.id };
  },

  async getPendingEmployees(orgId: string) {
    return await prisma.user.findMany({
      where: {
        orgId,
        role: 'EMPLOYEE',
        isActive: false,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });
  },

  async reviewPendingEmployee(
    orgId: string,
    adminUserId: string,
    employeeUserId: string,
    decision: 'APPROVE' | 'REJECT'
  ) {
    const pendingUser = await prisma.user.findFirst({
      where: {
        id: employeeUserId,
        orgId,
        role: 'EMPLOYEE',
        isActive: false,
      },
    });

    if (!pendingUser) {
      return null;
    }

    if (decision === 'APPROVE') {
      const approvedUser = await prisma.user.update({
        where: { id: pendingUser.id },
        data: {
          isActive: true,
          emailVerified: true,
        },
      });

      await NotificationService.createNotification(
        orgId,
        approvedUser.id,
        'Join Request Approved',
        'Your account is approved. You can now log in and view your schedule.',
        'JOIN_REQUEST_APPROVED',
        approvedUser.id,
        'USER'
      );

      return { status: 'APPROVED', user: approvedUser };
    }

    await prisma.user.delete({
      where: { id: pendingUser.id },
    });

    await NotificationService.createNotification(
      orgId,
      adminUserId,
      'Join Request Rejected',
      `Join request from ${pendingUser.firstName} ${pendingUser.lastName} was rejected.`,
      'JOIN_REQUEST_REJECTED',
      pendingUser.id,
      'USER'
    );

    return { status: 'REJECTED', user: pendingUser };
  },

  async invite(data: unknown): Promise<{ id: string; token: string } | null> {
    const { orgId, email, firstName, lastName, role } = validateInvite(data);

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return null;
    }

    const token = signInviteToken({ email, firstName, lastName, role, orgId });

    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        passwordHash: '',
        role,
        orgId,
        isActive: false,
        emailVerified: false,
        inviteToken: token,
        inviteTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      include: { org: true },
    });

    return { id: user.id, token };
  },

  async acceptInvite(rawToken: string, rawPassword: string): Promise<{ user: ReturnType<typeof sanitizeUser>; tokens: AuthTokens } | null> {
    const { token, password } = validateAcceptInvite({ token: rawToken, password: rawPassword });
    const decoded = verifyInviteToken(token);

    if (!decoded) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { email: decoded.email },
    });

    if (
      !user ||
      user.isActive ||
      user.inviteToken !== token ||
      !user.inviteTokenExpiry ||
      user.inviteTokenExpiry.getTime() < Date.now()
    ) {
      return null;
    }

    const passwordHash = await hashPassword(password);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        isActive: true,
        emailVerified: true,
        inviteToken: null,
        inviteTokenExpiry: null,
      },
    });

    const tokens = createTokens(user.id, user.orgId, user.role);

    return { user: sanitizeUser(user), tokens };
  },

  async forgotPassword(rawEmail: string): Promise<boolean> {
    const { email } = validateForgotPassword({ email: rawEmail });

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return false;
    }

    const token = signPasswordResetToken(user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    return true;
  },

  async resetPassword(rawToken: string, rawPassword: string): Promise<boolean> {
    const { token, password } = validatePasswordReset({ token: rawToken, password: rawPassword });
    const decoded = verifyPasswordResetToken(token);

    if (!decoded) {
      return false;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (
      !user ||
      !user.passwordResetToken ||
      user.passwordResetToken !== token ||
      !user.passwordResetTokenExpiry ||
      user.passwordResetTokenExpiry.getTime() < Date.now()
    ) {
      return false;
    }

    const passwordHash = await hashPassword(password);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetTokenExpiry: null,
      },
    });

    return true;
  },

  async refreshTokens(refreshToken: string): Promise<{ user: ReturnType<typeof sanitizeUser>; tokens: AuthTokens } | null> {
    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return {
      user: sanitizeUser(user),
      tokens: createTokens(user.id, user.orgId, user.role),
    };
  },

  async logout(_userId: string): Promise<void> {
    // For stateless JWT we do not persist session state here.
  },
};
