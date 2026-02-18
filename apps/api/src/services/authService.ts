import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { logger } from '../config/logger.js';
import { NotificationService } from './notificationService.js';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET as Secret;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const signToken = (payload: object, expiresIn: string): string => {
  const options: SignOptions = { expiresIn: expiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, JWT_SECRET, options);
};

export const validateLogin = (data: unknown): LoginCredentials => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
  });

  const parsed = schema.parse(data);
  return { email: parsed.email, password: parsed.password };
};

export const validateRegister = (data: unknown) => {
  const schema = z.object({
    orgId: z.string().uuid(),
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    password: z.string().min(8),
    role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']).optional(),
  });
  return schema.parse(data);
};

export const validateOwnerRegistration = (data: unknown) => {
  const schema = z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    password: z.string().min(8),
    organizationName: z.string().min(2),
    timezone: z.string().default('America/New_York'),
  });

  return schema.parse(data);
};

export const validateEmployeeJoinRegistration = (data: unknown) => {
  const schema = z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    password: z.string().min(8),
    organizationName: z.string().min(2),
  });

  return schema.parse(data);
};

export const validateInvite = (data: unknown) => {
  const schema = z.object({
    orgId: z.string().uuid(),
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']),
  });
  return schema.parse(data);
};

export const validatePasswordReset = (data: unknown) => {
  const schema = z.object({
    token: z.string().min(1),
    password: z.string().min(8),
  });
  return schema.parse(data);
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
  const accessToken = signToken({ userId, orgId, role }, JWT_EXPIRY);
  const refreshToken = signToken({ userId }, REFRESH_TOKEN_EXPIRY);
  return { accessToken, refreshToken };
};

export const verifyToken = (token: string): { userId: string; orgId: string; role: string } | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; orgId: string; role: string };
    return decoded;
  } catch {
    return null;
  }
};

export const AuthService = {
  async login(credentials: LoginCredentials): Promise<{ user: any; tokens: AuthTokens } | null> {
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

    return { user, tokens };
  },

  async register(data: unknown): Promise<{ user: any; tokens: AuthTokens } | null> {
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

    return { user, tokens };
  },

  async registerOwner(data: unknown): Promise<{ user: any; tokens: AuthTokens } | null> {
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
    return { user: result, tokens };
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

    const token = signToken({ email, firstName, lastName, role, orgId }, '7d');

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

  async acceptInvite(token: string, password: string): Promise<{ user: any; tokens: AuthTokens } | null> {
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { email: decoded.email },
    });

    if (!user || user.isActive) {
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

    return { user, tokens };
  },

  async forgotPassword(email: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return false;
    }

    const token = signToken({ userId: user.id }, '1h');

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    return true;
  },

  async resetPassword(token: string, password: string): Promise<boolean> {
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return false;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || !user.passwordResetToken || user.passwordResetToken !== token) {
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

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET) as { userId: string };
    } catch {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || !user.isActive) {
      return null;
    }

    const newTokens = createTokens(user.id, user.orgId, user.role);

    return newTokens;
  },

  async logout(_userId: string): Promise<void> {
    // For stateless JWT we do not persist session state here.
  },
};
