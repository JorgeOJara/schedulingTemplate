import api from './api';

export interface BusinessHour {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
}

export interface DefaultShiftTemplate {
  id?: string;
  name: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakDurationMinutes?: number;
  requiredHeadcount?: number;
  departmentId?: string | null;
  locationId?: string | null;
  active?: boolean;
}

export interface OrgSetup {
  id: string;
  name: string;
  timezone: string;
  setupCompleted: boolean;
  schedulingMode: 'PASSIVE' | 'PROACTIVE';
  aiAutoScheduleEnabled: boolean;
  clockInEarlyAllowanceMinutes: number;
  dailyOtcThreshold: number;
  weeklyOtcThreshold: number;
  maxHoursPerWeek: number;
  businessHours: BusinessHour[];
  defaultShiftTemplates: DefaultShiftTemplate[];
}

export const getOrgSetup = async (): Promise<OrgSetup> => {
  const response = await api.get('/setup/org');
  return response.data;
};

export const saveOrgSetup = async (payload: {
  timezone?: string;
  clockInEarlyAllowanceMinutes?: number;
  dailyOtcThreshold?: number;
  weeklyOtcThreshold?: number;
  maxHoursPerWeek?: number;
  schedulingMode?: 'PASSIVE' | 'PROACTIVE';
  aiAutoScheduleEnabled?: boolean;
  businessHours: BusinessHour[];
  defaultShiftTemplates: DefaultShiftTemplate[];
}) => {
  const response = await api.put('/setup/org', payload);
  return response.data as OrgSetup;
};

export const applyDefaultTemplatesToWeek = async (weekId: string) => {
  const response = await api.post(`/setup/week/${weekId}/apply-defaults`);
  return response.data as { createdCount: number };
};
