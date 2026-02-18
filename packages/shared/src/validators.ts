import { z } from 'zod';

// Common validation patterns
const email = z.string().email();
const name = z.string().min(1).max(50);
const password = z.string().min(8).max(100);
const uuid = z.string().uuid();
const nonEmptyString = z.string().min(1);

// Shift validation schemas
export const shiftCreateSchema = z.object({
  scheduleWeekId: uuid,
  employeeId: uuid.optional().nullable(),
  departmentId: uuid.optional().nullable(),
  locationId: uuid.optional().nullable(),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  breakDurationMinutes: z.number().int().min(0).max(120).optional(),
  breakIsPaid: z.boolean().optional(),
  notes: z.string().optional(),
  shiftType: z.enum(['REGULAR', 'ON_CALL', 'OVERTIME', 'DOUBLE_OVERTIME']).optional(),
  isOnCall: z.boolean().optional(),
});

export const shiftUpdateSchema = z.object({
  employeeId: uuid.optional().nullable(),
  departmentId: uuid.optional().nullable(),
  locationId: uuid.optional().nullable(),
  startTime: z.string().min(1).optional(),
  endTime: z.string().min(1).optional(),
  breakDurationMinutes: z.number().int().min(0).max(120).optional(),
  breakIsPaid: z.boolean().optional(),
  notes: z.string().optional(),
  shiftType: z.enum(['REGULAR', 'ON_CALL', 'OVERTIME', 'DOUBLE_OVERTIME']).optional(),
  isOnCall: z.boolean().optional(),
  status: z.enum(['SCHEDULED', 'SWAPPED', 'CANCELLATION_REQUESTED']).optional(),
});

// Time-off validation schemas
export const timeOffCreateSchema = z.object({
  orgId: uuid,
  employeeId: uuid,
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  type: z.enum(['VACATION', 'SICK', 'PERSONAL', 'BEREAVEMENT', 'JURY_DUTY']),
  reason: z.string().min(1).max(1000),
});

export const timeOffUpdateSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'DENIED']),
  approvedById: uuid.optional(),
  notes: z.string().optional(),
});

// Shift swap validation schemas
export const shiftSwapCreateSchema = z.object({
  orgId: uuid,
  requestorId: uuid,
  responderId: uuid,
  proposedShiftIds: z.array(uuid),
  requestedShiftIds: z.array(uuid),
  type: z.enum(['FULL_DAY', 'PARTIAL_DAY', 'SHIFTS']),
  reason: z.string().min(1).max(1000),
});

export const shiftSwapUpdateSchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'DENIED', 'APPROVED', 'REJECTED']),
  approvedById: uuid.optional(),
  notes: z.string().optional(),
});

// Auth validation schemas
export const loginSchema = z.object({
  email: email,
  password: password,
});

export const registerSchema = z.object({
  orgId: uuid,
  email: email,
  firstName: name,
  lastName: name,
  password: password,
});

export const passwordResetSchema = z.object({
  token: z.string().min(1),
  password: password,
});

// Organization validation schemas
export const orgCreateSchema = z.object({
  name: z.string().min(1).max(100),
  timezone: z.string().min(1),
  dailyOtcThreshold: z.number().int().min(0).max(24).optional(),
  weeklyOtcThreshold: z.number().int().min(0).max(168).optional(),
  minRestBetweenShifts: z.number().int().min(0).optional(),
  maxHoursPerWeek: z.number().int().min(0).optional(),
});

export const orgUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  timezone: z.string().min(1).optional(),
  dailyOtcThreshold: z.number().int().min(0).max(24).optional(),
  weeklyOtcThreshold: z.number().int().min(0).max(168).optional(),
  minRestBetweenShifts: z.number().int().min(0).optional(),
  maxHoursPerWeek: z.number().int().min(0).optional(),
});

// Department validation schemas
export const departmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  orgId: uuid,
  active: z.boolean().optional(),
});

// Location validation schemas
export const locationSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().optional(),
  phone: z.string().optional(),
  orgId: uuid,
  active: z.boolean().optional(),
});

// Schedule validation schemas
export const scheduleWeekSchema = z.object({
  orgId: uuid,
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  state: z.enum(['DRAFT', 'PUBLISHED']).optional(),
});

export const schedulePublishSchema = z.object({
  orgId: uuid,
  publishedById: uuid,
  notes: z.string().optional(),
});
