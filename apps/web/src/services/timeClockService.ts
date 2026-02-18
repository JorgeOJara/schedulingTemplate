import api from './api';

export interface ClockStatus {
  policy: {
    clockInEarlyAllowanceMinutes: number;
    timezone: string;
  };
  activeEntry: any | null;
  eligibleShift: {
    id: string;
    startTime: string;
    endTime: string;
    canClockIn: boolean;
  } | null;
  earliestClockInAt: string | null;
}

export const getClockStatus = async (): Promise<ClockStatus> => {
  const response = await api.get('/time-clock/status');
  return response.data;
};

export const clockIn = async (shiftId?: string) => {
  const response = await api.post('/time-clock/clock-in', { shiftId });
  return response.data;
};

export const clockOut = async (payload?: { timeEntryId?: string; shiftId?: string }) => {
  const response = await api.post('/time-clock/clock-out', payload ?? {});
  return response.data;
};

export const getMyWeeklyHours = async (weekStart?: string) => {
  const response = await api.get('/time-clock/my-week', {
    params: { weekStart },
  });
  return response.data;
};

export const getOrgWeeklyHoursComparison = async (weekId?: string, exportCsv?: boolean) => {
  if (exportCsv) {
    const response = await api.get('/analytics/hours-comparison', {
      params: { weekId, export: 'csv' },
      responseType: 'blob',
    });
    return response.data as Blob;
  }

  const response = await api.get('/analytics/hours-comparison', {
    params: { weekId },
  });
  return response.data;
};
