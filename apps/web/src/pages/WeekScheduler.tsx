import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, MapPin, Briefcase, User, Wand2, ChevronRight, UserPlus, Trash2, Sparkles, SlidersHorizontal } from 'lucide-react';
import api from '../services/api';
import { queryKeys } from '../hooks/useQueryKeys';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { useAuthStore } from '../store/authStore';
import {
  applyDefaultTemplatesToWeek,
  getOrgSetup,
  saveOrgSetup,
  type BusinessHour,
  type DefaultShiftTemplate,
} from '../services/setupService';

interface Shift {
  id: string;
  scheduleWeekId?: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  isOnCall: boolean;
  departmentId?: string | null;
  locationId?: string | null;
  employeeId: string | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
  } | null;
  department: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
}

interface ScheduleWeek {
  id: string;
  startDate: string;
  endDate: string;
  state: string;
}

interface EnsureWeeksResponse {
  createdWeeks: string[];
  weeks: ScheduleWeek[];
  schedulingMode: 'PASSIVE' | 'PROACTIVE';
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  active: boolean;
}

interface NewAssignmentDraft {
  id: string;
  baseShiftId: string;
  employeeId: string;
}

interface ShiftGroup {
  key: string;
  shifts: Shift[];
}

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const fetchScheduleWeeks = async (): Promise<ScheduleWeek[]> => {
  const response = await api.get('/schedules/week');
  return response.data;
};

const fetchShifts = async (weekId: string): Promise<Shift[]> => {
  const response = await api.get('/shifts', { params: { weekId } });
  return response.data;
};

const fetchEmployees = async (orgId: string): Promise<Employee[]> => {
  const response = await api.get(`/org/${orgId}/employees`);
  return response.data;
};

const ensureWeeks = async (weeksAhead: number): Promise<EnsureWeeksResponse> => {
  const response = await api.post('/schedules/week/ensure', { weeksAhead });
  return response.data;
};

const groupShiftsByTimeframe = (shiftList: Shift[]): ShiftGroup[] => {
  const groups: ShiftGroup[] = [];
  const map = new Map<string, Shift[]>();

  shiftList.forEach((shift) => {
    const key = [
      new Date(shift.startTime).getTime(),
      new Date(shift.endTime).getTime(),
    ].join('|');

    const bucket = map.get(key);
    if (bucket) {
      bucket.push(shift);
    } else {
      map.set(key, [shift]);
    }
  });

  map.forEach((shifts, key) => {
    groups.push({
      key,
      shifts: shifts.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    });
  });

  return groups.sort((a, b) => a.shifts[0].startTime.localeCompare(b.shifts[0].startTime));
};

export const WeekScheduler = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isManagerView = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [selectedWeekId, setSelectedWeekId] = useState<string>('');
  const [setupHours, setSetupHours] = useState<BusinessHour[]>([]);
  const [templates, setTemplates] = useState<DefaultShiftTemplate[]>([
    { name: 'Morning Shift', dayOfWeek: 1, startTime: '09:00', endTime: '17:00', requiredHeadcount: 1 },
  ]);
  const [schedulingMode, setSchedulingMode] = useState<'PASSIVE' | 'PROACTIVE'>('PASSIVE');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedShiftGroupKey, setSelectedShiftGroupKey] = useState<string | null>(null);
  const [pendingAssignments, setPendingAssignments] = useState<Record<string, string>>({});
  const [newAssignments, setNewAssignments] = useState<NewAssignmentDraft[]>([]);
  const [removedShiftIds, setRemovedShiftIds] = useState<Set<string>>(new Set());
  const [preparedProactiveWindow, setPreparedProactiveWindow] = useState(false);
  const [showStrategyConfig, setShowStrategyConfig] = useState(false);
  const [pendingModeChange, setPendingModeChange] = useState<'PASSIVE' | 'PROACTIVE' | null>(null);
  const [daySaveFeedback, setDaySaveFeedback] = useState<string>('');

  const { data: weeks, isLoading: weeksLoading } = useQuery({
    queryKey: queryKeys.schedules.week('list'),
    queryFn: fetchScheduleWeeks,
  });

  const { data: setup } = useQuery({
    queryKey: queryKeys.setup.org(),
    queryFn: getOrgSetup,
  });

  const { data: shifts, isLoading: shiftsLoading } = useQuery({
    queryKey: queryKeys.shifts.list(selectedWeekId),
    queryFn: () => fetchShifts(selectedWeekId),
    enabled: !!selectedWeekId,
  });

  const { data: employees = [] } = useQuery({
    queryKey: queryKeys.organizations.employees(user?.orgId || 'unknown'),
    queryFn: () => fetchEmployees(user!.orgId!),
    enabled: Boolean(user?.orgId),
  });

  const getEmployeeRole = (employeeId: string) => {
    const employee = employees.find((e) => e.id === employeeId);
    return employee?.role || 'Employee';
  };

  const saveDayChangesMutation = useMutation({
    mutationFn: async () => {
      const updates = selectedDayShifts
        .filter((shift) => !removedShiftIds.has(shift.id))
        .filter((shift) => pendingAssignments[shift.id] !== undefined)
        .filter((shift) => {
          const value = pendingAssignments[shift.id];
          return Boolean(value) && value !== (shift.employeeId ?? '');
        })
        .map((shift) => ({
          shiftId: shift.id,
          employeeId: pendingAssignments[shift.id],
        }));

      const creates = newAssignments.reduce<
        Array<{
          scheduleWeekId: string;
          startTime: string;
          endTime: string;
          departmentId?: string;
          locationId?: string;
          employeeId: string | null;
        }>
      >((acc, entry) => {
        if (!entry.baseShiftId) return acc;
        const baseShift = selectedDayShifts.find((shift) => shift.id === entry.baseShiftId);
        if (!baseShift) return acc;

        acc.push({
            scheduleWeekId: baseShift.scheduleWeekId ?? selectedWeekId,
            startTime: baseShift.startTime,
            endTime: baseShift.endTime,
            departmentId: baseShift.departmentId ?? baseShift.department?.id ?? undefined,
            locationId: baseShift.locationId ?? baseShift.location?.id ?? undefined,
            employeeId: entry.employeeId || null,
        });
        return acc;
      }, []);

      const deletions = Array.from(removedShiftIds);
      const warnings: string[] = [];

      for (const update of updates) {
        await api.put(`/shifts/${update.shiftId}`, { employeeId: update.employeeId });
      }

      for (const create of creates) {
        try {
          await api.post('/shifts', create);
        } catch (error: any) {
          const message = String(error?.response?.data?.error || error?.message || '');
          const overlap = message.toLowerCase().includes('overlap');
          if (overlap && create.employeeId) {
            await api.post('/shifts', {
              ...create,
              employeeId: null,
            });
            warnings.push('One or more selected employees had overlaps. Slots were created as unassigned.');
          } else {
            throw error;
          }
        }
      }

      for (const shiftId of deletions) {
        await api.delete(`/shifts/${shiftId}`);
      }

      return { warnings };
    },
    onSuccess: (result) => {
      setPendingAssignments({});
      setNewAssignments([]);
      setRemovedShiftIds(new Set());
      if (result?.warnings?.length) {
        setDaySaveFeedback(result.warnings[0]);
      } else {
        setDaySaveFeedback('Shift slots saved.');
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.list(selectedWeekId) });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'hours-comparison'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || error?.message || 'Failed to save shift changes';
      setDaySaveFeedback(message);
    },
  });

  const saveSetupMutation = useMutation({
    mutationFn: async () =>
      saveOrgSetup({
        businessHours: setupHours,
        defaultShiftTemplates: templates,
        clockInEarlyAllowanceMinutes: setup?.clockInEarlyAllowanceMinutes ?? 5,
        timezone: setup?.timezone,
        dailyOtcThreshold: setup?.dailyOtcThreshold,
        weeklyOtcThreshold: setup?.weeklyOtcThreshold,
        maxHoursPerWeek: setup?.maxHoursPerWeek,
        schedulingMode,
        aiAutoScheduleEnabled: false,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.setup.org() });
    },
  });

  const applyDefaultsMutation = useMutation({
    mutationFn: async () => applyDefaultTemplatesToWeek(selectedWeekId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.list(selectedWeekId) });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'hours-comparison'] });
    },
  });

  const planningMutation = useMutation({
    mutationFn: (weeksAhead: number) => ensureWeeks(weeksAhead),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.week('list') });
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.list(selectedWeekId) });
    },
  });

  const updateModeMutation = useMutation({
    mutationFn: async (mode: 'PASSIVE' | 'PROACTIVE') =>
      saveOrgSetup({
        businessHours: setup?.businessHours ?? setupHours,
        defaultShiftTemplates: setup?.defaultShiftTemplates ?? templates,
        clockInEarlyAllowanceMinutes: setup?.clockInEarlyAllowanceMinutes ?? 5,
        timezone: setup?.timezone,
        dailyOtcThreshold: setup?.dailyOtcThreshold,
        weeklyOtcThreshold: setup?.weeklyOtcThreshold,
        maxHoursPerWeek: setup?.maxHoursPerWeek,
        schedulingMode: mode,
        aiAutoScheduleEnabled: false,
      }),
    onSuccess: (_, mode) => {
      setSchedulingMode(mode);
      queryClient.invalidateQueries({ queryKey: queryKeys.setup.org() });
      if (mode === 'PROACTIVE') {
        planningMutation.mutate(4);
        setPreparedProactiveWindow(true);
      }
    },
  });

  useEffect(() => {
    if (weeks && weeks.length > 0 && !selectedWeekId) {
      const now = new Date().getTime();
      const sorted = [...weeks].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      const current =
        sorted.find((week) => {
          const start = new Date(week.startDate).getTime();
          const end = new Date(week.endDate).getTime();
          return start <= now && now < end;
        }) ?? sorted[0];
      setSelectedWeekId(current.id);
    }
  }, [weeks, selectedWeekId]);

  useEffect(() => {
    if (!isManagerView || weeksLoading || schedulingMode !== 'PROACTIVE' || preparedProactiveWindow) return;
    if ((weeks?.length ?? 0) < 5) {
      planningMutation.mutate(4);
    }
    setPreparedProactiveWindow(true);
  }, [isManagerView, planningMutation, preparedProactiveWindow, schedulingMode, weeks, weeksLoading]);

  useEffect(() => {
    if (setup?.businessHours?.length) {
      setSetupHours(
        setup.businessHours.map((entry) => ({
          dayOfWeek: entry.dayOfWeek,
          openTime: entry.openTime,
          closeTime: entry.closeTime,
          isClosed: entry.isClosed,
        }))
      );
    } else {
      setSetupHours(
        dayNames.map((_, dayOfWeek) => ({
          dayOfWeek,
          openTime: dayOfWeek === 0 || dayOfWeek === 6 ? null : '09:00',
          closeTime: dayOfWeek === 0 || dayOfWeek === 6 ? null : '17:00',
          isClosed: dayOfWeek === 0 || dayOfWeek === 6,
        }))
      );
    }

    if (setup?.defaultShiftTemplates?.length) {
      setTemplates(
        setup.defaultShiftTemplates.map((template) => ({
          ...template,
          requiredHeadcount: template.requiredHeadcount ?? 1,
        }))
      );
    }
    setSchedulingMode(setup?.schedulingMode ?? 'PASSIVE');
  }, [setup]);

  useEffect(() => {
    if (schedulingMode !== 'PASSIVE' || !weeks?.length) return;

    const now = new Date().getTime();
    const sorted = [...weeks].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const current =
      sorted.find((week) => {
        const start = new Date(week.startDate).getTime();
        const end = new Date(week.endDate).getTime();
        return start <= now && now < end;
      }) ?? sorted[0];

    if (current && current.id !== selectedWeekId) {
      setSelectedWeekId(current.id);
    }
  }, [schedulingMode, selectedWeekId, weeks]);

  const shiftsByDay = useMemo(() => {
    const grouped: Record<number, Shift[]> = {};
    const shiftList = shifts ?? [];

    shiftList.forEach((shift) => {
      const day = new Date(shift.startTime).getDay();
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(shift);
    });

    Object.keys(grouped).forEach((key) => {
      const day = Number(key);
      grouped[day] = grouped[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    return grouped;
  }, [shifts]);

  const selectedDayShifts = selectedDay === null ? [] : shiftsByDay[selectedDay] ?? [];
  const selectedDayShiftGroups = useMemo(() => groupShiftsByTimeframe(selectedDayShifts), [selectedDayShifts]);
  const selectedDayLabel = selectedDay === null ? '' : dayNames[selectedDay];
  const selectedShiftGroup =
    selectedShiftGroupKey === null ? null : selectedDayShiftGroups.find((group) => group.key === selectedShiftGroupKey) ?? null;
  const hasPendingUpdates = selectedDayShifts.some((shift) => {
    if (removedShiftIds.has(shift.id)) return false;
    const value = pendingAssignments[shift.id];
    return Boolean(value) && value !== (shift.employeeId ?? '');
  });
  const hasPendingRemovals = removedShiftIds.size > 0;
  const hasPendingCreates = newAssignments.some((entry) => Boolean(entry.baseShiftId));
  const hasUnsavedChanges = hasPendingUpdates || hasPendingCreates || hasPendingRemovals;

  const closeDayModal = () => {
    setSelectedDay(null);
    setSelectedShiftGroupKey(null);
    setPendingAssignments({});
    setNewAssignments([]);
    setRemovedShiftIds(new Set());
    setDaySaveFeedback('');
  };

  const addNewAssignmentCard = (baseShiftId: string) => {
    setNewAssignments((current) => [
      ...current,
      {
        id: `new-${Date.now()}-${current.length}`,
        baseShiftId,
        employeeId: '',
      },
    ]);
  };

  const switchSchedulingMode = (nextMode: 'PASSIVE' | 'PROACTIVE') => {
    if (nextMode === schedulingMode || updateModeMutation.isPending) return;
    setPendingModeChange(nextMode);
  };

  const confirmModeChange = () => {
    if (!pendingModeChange) return;
    updateModeMutation.mutate(pendingModeChange, {
      onSuccess: () => {
        setPendingModeChange(null);
      },
      onError: () => {
        setPendingModeChange(null);
      },
    });
  };

  if (weeksLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (isManagerView && setup && !setup.setupCompleted) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>First-Time Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Business Hours</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {setupHours.map((hour, index) => (
                  <div key={hour.dayOfWeek} className="border border-slate-200 rounded-lg p-3 space-y-2">
                    <div className="font-medium text-sm">{dayNames[hour.dayOfWeek]}</div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={hour.isClosed}
                        onChange={(e) => {
                          setSetupHours((current) =>
                            current.map((row, rowIndex) =>
                              rowIndex === index
                                ? {
                                    ...row,
                                    isClosed: e.target.checked,
                                    openTime: e.target.checked ? null : row.openTime ?? '09:00',
                                    closeTime: e.target.checked ? null : row.closeTime ?? '17:00',
                                  }
                                : row
                            )
                          );
                        }}
                      />
                      Closed
                    </label>
                    {!hour.isClosed && (
                      <div className="flex gap-2">
                        <input
                          type="time"
                          value={hour.openTime ?? '09:00'}
                          className="border border-slate-300 rounded px-2 py-1 text-sm"
                          onChange={(e) => {
                            const value = e.target.value;
                            setSetupHours((current) =>
                              current.map((row, rowIndex) =>
                                rowIndex === index ? { ...row, openTime: value } : row
                              )
                            );
                          }}
                        />
                        <input
                          type="time"
                          value={hour.closeTime ?? '17:00'}
                          className="border border-slate-300 rounded px-2 py-1 text-sm"
                          onChange={(e) => {
                            const value = e.target.value;
                            setSetupHours((current) =>
                              current.map((row, rowIndex) =>
                                rowIndex === index ? { ...row, closeTime: value } : row
                              )
                            );
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Default Shift Templates</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setTemplates((current) => [
                      ...current,
                      {
                        name: `Template ${current.length + 1}`,
                        dayOfWeek: 1,
                        startTime: '09:00',
                        endTime: '17:00',
                        requiredHeadcount: 1,
                      },
                    ])
                  }
                >
                  Add Template
                </Button>
              </div>
              {templates.map((template, index) => (
                <div key={`template-${index}`} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  <input
                    className="border border-slate-300 rounded px-2 py-1 text-sm"
                    value={template.name}
                    placeholder="Template name"
                    onChange={(e) => {
                      const value = e.target.value;
                      setTemplates((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, name: value } : row
                        )
                      );
                    }}
                  />
                  <Select
                    options={dayNames.map((day, dayOfWeek) => ({ value: String(dayOfWeek), label: day }))}
                    value={String(template.dayOfWeek)}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setTemplates((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, dayOfWeek: value } : row
                        )
                      );
                    }}
                  />
                  <input
                    type="time"
                    className="border border-slate-300 rounded px-2 py-1 text-sm"
                    value={template.startTime}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTemplates((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, startTime: value } : row
                        )
                      );
                    }}
                  />
                  <input
                    type="time"
                    className="border border-slate-300 rounded px-2 py-1 text-sm"
                    value={template.endTime}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTemplates((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, endTime: value } : row
                        )
                      );
                    }}
                  />
                  <input
                    type="number"
                    min={1}
                    className="border border-slate-300 rounded px-2 py-1 text-sm"
                    value={template.requiredHeadcount ?? 1}
                    onChange={(e) => {
                      const value = Number(e.target.value) || 1;
                      setTemplates((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, requiredHeadcount: value } : row
                        )
                      );
                    }}
                  />
                </div>
              ))}
            </div>

            <Button onClick={() => saveSetupMutation.mutate()} isLoading={saveSetupMutation.isPending}>
              Save Setup and Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const unassignedCount = (shifts ?? []).filter((shift) => !shift.employeeId).length;
  const weekOptions = [...(weeks ?? [])].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  const selectedWeekIndex = weekOptions.findIndex((week) => week.id === selectedWeekId);
  const selectedWeek = selectedWeekIndex >= 0 ? weekOptions[selectedWeekIndex] : null;

  const goToPreviousWeek = () => {
    if (selectedWeekIndex > 0) {
      setSelectedWeekId(weekOptions[selectedWeekIndex - 1].id);
    }
  };

  const goToNextWeek = () => {
    if (selectedWeekIndex >= 0 && selectedWeekIndex < weekOptions.length - 1) {
      setSelectedWeekId(weekOptions[selectedWeekIndex + 1].id);
      return;
    }

    if (isManagerView && schedulingMode === 'PROACTIVE' && selectedWeek) {
      planningMutation.mutate(4, {
        onSuccess: (result) => {
          const sorted = [...(result.weeks ?? [])].sort(
            (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
          );
          const currentStart = new Date(selectedWeek.startDate).getTime();
          const next = sorted.find((week) => new Date(week.startDate).getTime() > currentStart);
          if (next) {
            setSelectedWeekId(next.id);
          }
        },
      });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Weekly Scheduler</h2>
          <p className="text-sm text-slate-500">Plan this week, next week, or up to a month ahead</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          {schedulingMode === 'PROACTIVE' ? (
            <>
              <Button size="sm" variant="outline" onClick={goToPreviousWeek} disabled={selectedWeekIndex <= 0}>
                ←
              </Button>
              <div className="text-center min-w-[220px]">
                <div className="text-xs text-slate-500">Selected Week</div>
                <div className="text-sm font-semibold text-slate-900">
                  {selectedWeek
                    ? `${new Date(selectedWeek.startDate).toLocaleDateString()} - ${new Date(selectedWeek.endDate).toLocaleDateString()}`
                    : 'Select a week'}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={goToNextWeek} isLoading={planningMutation.isPending}>
                →
              </Button>
            </>
          ) : (
            <div className="text-center min-w-[220px]">
              <div className="text-xs text-slate-500">Schedule Mode</div>
              <div className="text-sm font-semibold text-slate-900">Passive (Static)</div>
            </div>
          )}
          {isManagerView && (
            <Button size="sm" variant="outline" onClick={() => setShowStrategyConfig(true)} className="flex items-center gap-1">
              <SlidersHorizontal className="h-4 w-4" />
              Schedule Config
            </Button>
          )}
          {isManagerView && selectedWeekId && (
            <Button size="sm" variant="outline" onClick={() => applyDefaultsMutation.mutate()} isLoading={applyDefaultsMutation.isPending}>
              <Wand2 className="h-4 w-4" />
              Apply Defaults
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Calendar className="h-4 w-4" />
              Total shifts
            </div>
            <div className="text-2xl font-bold text-slate-900">{(shifts ?? []).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <User className="h-4 w-4" />
              Unassigned
            </div>
            <div className="text-2xl font-bold text-amber-600">{unassignedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Clock className="h-4 w-4" />
              Week state
            </div>
            <div className="text-base font-semibold text-slate-900">{selectedWeek?.state ?? 'N/A'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Briefcase className="h-4 w-4" />
              Scheduling mode
            </div>
            <div className="text-base font-semibold text-slate-900">{schedulingMode}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {dayNames.map((dayName, dayOfWeek) => {
          const dayShifts = shiftsByDay[dayOfWeek] ?? [];
          const dayUnassigned = dayShifts.filter((shift) => !shift.employeeId).length;
          return (
            <Card key={dayName} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedDay(dayOfWeek)}>
              <CardContent className="pt-5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-900">{dayName}</div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
                <div className="text-sm text-slate-600">{dayShifts.length} shift slots</div>
                <div className="text-xs text-amber-600">{dayUnassigned} unassigned</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Modal
        isOpen={selectedDay !== null}
        onClose={closeDayModal}
        title={`Manage ${selectedDayLabel}`}
        action={
          <>
            <Button variant="ghost" onClick={closeDayModal}>
              Cancel
            </Button>
            <Button onClick={() => saveDayChangesMutation.mutate()} isLoading={saveDayChangesMutation.isPending} disabled={!hasUnsavedChanges}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {daySaveFeedback && (
            <div className="text-sm rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
              {daySaveFeedback}
            </div>
          )}

          {shiftsLoading ? (
            <div className="text-sm text-slate-500">Loading shifts...</div>
          ) : selectedDayShiftGroups.length === 0 ? (
            <div className="text-sm text-slate-500">No shifts configured for this day.</div>
          ) : (
            <div className="space-y-4">
              {selectedShiftGroup && (
                <div className="text-xs text-slate-500">
                  Selected time block: {new Date(selectedShiftGroup.shifts[0].startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} -{' '}
                  {new Date(selectedShiftGroup.shifts[0].endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </div>
              )}

              {selectedDayShiftGroups.map((group) => {
                const anchorShift = group.shifts[0];
                const isSelected = selectedShiftGroupKey === group.key;
                const groupNewAssignments = newAssignments.filter((entry) => entry.baseShiftId === anchorShift.id);

                return (
                  <div
                    key={group.key}
                    className={`rounded-lg border p-3 space-y-3 ${isSelected ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200'}`}
                    onClick={() => setSelectedShiftGroupKey(group.key)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900">
                        {new Date(anchorShift.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} -{' '}
                        {new Date(anchorShift.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </div>
                      <div className="text-xs text-slate-500">{group.shifts.length + groupNewAssignments.length} positions</div>
                    </div>

                    {group.shifts.map((shift) => (
                      <div key={shift.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <MapPin className="w-3.5 h-3.5" />
                            {shift.location?.name ?? 'No location'}
                          </div>
                          <Select
                            value={pendingAssignments[shift.id] ?? shift.employeeId ?? ''}
                            onChange={(e) => setPendingAssignments((current) => ({ ...current, [shift.id]: e.target.value }))}
                            options={[
                              { value: '', label: 'Unassigned' },
                              ...employees
                                .filter((employee) => employee.active)
                                .map((employee) => ({
                                  value: employee.id,
                                  label: `${employee.firstName} ${employee.lastName} (${employee.role})`,
                                })),
                            ]}
                          />
                        </div>
                        {isManagerView && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRemovedShiftIds((current) => new Set([...Array.from(current), shift.id]));
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}

                    {groupNewAssignments.map((entry) => (
                      <div key={entry.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center">
                        <div className="space-y-1">
                          <div className="text-xs text-slate-500">New position</div>
                          <Select
                            value={entry.employeeId}
                            onChange={(e) =>
                              setNewAssignments((current) =>
                                current.map((row) => (row.id === entry.id ? { ...row, employeeId: e.target.value } : row))
                              )
                            }
                            options={[
                              { value: '', label: 'Unassigned' },
                              ...employees
                                .filter((employee) => employee.active)
                                .map((employee) => ({
                                  value: employee.id,
                                  label: `${employee.firstName} ${employee.lastName} (${getEmployeeRole(employee.id)})`,
                                })),
                            ]}
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewAssignments((current) => current.filter((row) => row.id !== entry.id));
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}

                    {isManagerView && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          addNewAssignmentCard(anchorShift.id);
                        }}
                        className="flex items-center gap-2 w-full justify-center"
                      >
                        <UserPlus className="w-4 h-4" />
                        Add Position to This Shift Time
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showStrategyConfig}
        onClose={() => setShowStrategyConfig(false)}
        title="Scheduling Config"
        action={
          <Button variant="outline" onClick={() => setShowStrategyConfig(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Pick how future weeks behave before making major changes.
          </p>
          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={() => switchSchedulingMode('PASSIVE')}
              className={`text-left rounded-lg border p-4 transition-colors ${
                schedulingMode === 'PASSIVE'
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="font-semibold text-slate-900">Passive (Static)</div>
              <p className="text-sm text-slate-600 mt-1">
                Best for fixed teams. People assigned this week are carried into future weeks automatically.
              </p>
            </button>
            <button
              type="button"
              onClick={() => switchSchedulingMode('PROACTIVE')}
              className={`text-left rounded-lg border p-4 transition-colors ${
                schedulingMode === 'PROACTIVE'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="font-semibold text-slate-900">Proactive (Week-by-Week)</div>
              <p className="text-sm text-slate-600 mt-1">
                Shift timeframes carry forward, but assignments are cleared so you can rebalance each week.
              </p>
            </button>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Proactive mode requires active weekly planning. Use it only if your team schedule changes often.
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div>
              <div className="text-sm font-semibold text-slate-900">AI Auto-Schedule</div>
              <p className="text-xs text-slate-600">Coming soon. This option is visible for future rollout.</p>
            </div>
            <Button size="sm" variant="outline" disabled className="flex items-center gap-1">
              <Sparkles className="w-4 h-4" />
              Disabled
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={pendingModeChange !== null}
        onClose={() => setPendingModeChange(null)}
        title="Confirm Mode Change"
        action={
          <>
            <Button variant="ghost" onClick={() => setPendingModeChange(null)}>
              Cancel
            </Button>
            <Button onClick={confirmModeChange} isLoading={updateModeMutation.isPending}>
              Confirm
            </Button>
          </>
        }
      >
        {pendingModeChange === 'PROACTIVE' ? (
          <div className="space-y-3 text-sm text-slate-700">
            <p className="font-medium text-slate-900">You are switching to Proactive scheduling.</p>
            <p>Future weeks keep timeframes, but assignments are cleared so you can plan each week.</p>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-slate-700">
            <p className="font-medium text-slate-900">You are switching to Passive (Static) scheduling.</p>
            <p>Assigned people carry forward automatically, giving a stable repeating schedule.</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default WeekScheduler;
