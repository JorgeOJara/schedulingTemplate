// Shared types for the scheduling application

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}

export interface ShiftType {
  id: string;
  name: string;
  code: 'REGULAR' | 'OVERTIME' | 'DOUBLE_OVERTIME';
}

export interface ScheduleState {
  DRAFT: 'DRAFT';
  PUBLISHED: 'PUBLISHED';
}

export interface TimeOffStatus {
  PENDING: 'PENDING';
  APPROVED: 'APPROVED';
  DENIED: 'DENIED';
}

export interface NotificationType {
  INFO: 'INFO';
  SUCCESS: 'SUCCESS';
  WARNING: 'WARNING';
  ERROR: 'ERROR';
}

export interface TimeOffType {
  VACATION: 'VACATION';
  SICK: 'SICK';
  PERSONAL: 'PERSONAL';
  BEREAVEMENT: 'BEREAVEMENT';
  JURY_DUTY: 'JURY_DUTY';
}

export interface ShiftSwapStatus {
  PENDING: 'PENDING';
  ACCEPTED: 'ACCEPTED';
  DENIED: 'DENIED';
  APPROVED: 'APPROVED';
  REJECTED: 'REJECTED';
}

export interface ShiftSwapType {
  FULL_DAY: 'FULL_DAY';
  PARTIAL_DAY: 'PARTIAL_DAY';
  SHIFTS: 'SHIFTS';
}

export interface UserRole {
  ADMIN: 'ADMIN';
  MANAGER: 'MANAGER';
  EMPLOYEE: 'EMPLOYEE';
}

export interface ShiftStatus {
  SCHEDULED: 'SCHEDULED';
  SWAPPED: 'SWAPPED';
  CANCELLATION_REQUESTED: 'CANCELLATION_REQUESTED';
}
