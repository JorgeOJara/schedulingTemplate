export const queryKeys = {
  auth: {
    me: () => ['auth', 'me'],
  },
  organizations: {
    me: () => ['organizations', 'me'],
    employees: (orgId: string) => ['organizations', orgId, 'employees'],
  },
  setup: {
    org: () => ['setup', 'org'],
  },
  users: {
    me: () => ['users', 'me'],
    detail: (userId: string) => ['users', userId],
  },
  departments: {
    list: (orgId: string) => ['departments', orgId],
    detail: (id: string) => ['departments', id],
  },
  locations: {
    list: (orgId: string) => ['locations', orgId],
    detail: (id: string) => ['locations', id],
  },
  schedules: {
    week: (weekId: string) => ['schedules', weekId],
    weeklySummary: (weekId?: string) => ['schedules', 'weekly-summary', weekId],
    mySchedule: (startDate: string, endDate: string) => 
      ['schedules', 'my-schedule', startDate, endDate],
  },
  shifts: {
    list: (weekId: string) => ['shifts', weekId],
    detail: (id: string) => ['shifts', id],
  },
  timeOff: {
    list: (orgId: string) => ['time-off', orgId],
    myRequests: (userId: string) => ['time-off', userId, 'my-requests'],
    detail: (id: string) => ['time-off', id],
  },
  shiftSwaps: {
    list: (orgId: string) => ['shift-swaps', orgId],
    myRequests: (userId: string) => ['shift-swaps', userId, 'my-requests'],
    detail: (id: string) => ['shift-swaps', id],
  },
  analytics: {
    summary: (weekId?: string) => ['analytics', 'summary', weekId],
    breakdown: (orgId: string) => ['analytics', 'breakdown', orgId],
    coverage: (weekId?: string) => ['analytics', 'coverage', weekId],
    hoursComparison: (weekId?: string) => ['analytics', 'hours-comparison', weekId],
  },
  timeClock: {
    status: () => ['time-clock', 'status'],
    myWeek: (weekStart?: string) => ['time-clock', 'my-week', weekStart],
  },
  notifications: {
    list: (userId: string) => ['notifications', userId],
    unreadCount: (userId: string) => ['notifications', userId, 'unread-count'],
  },
};
