import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { useAuthStore } from '../store/authStore';
import { queryKeys } from '../hooks/useQueryKeys';
import {
  getOrgSetup,
  saveOrgSetup,
  type BusinessHour,
  type DefaultShiftTemplate,
} from '../services/setupService';

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const Settings = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canManageOrg = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);
  const [templates, setTemplates] = useState<DefaultShiftTemplate[]>([]);
  const [feedback, setFeedback] = useState<string>('');

  const { data: setup, isLoading } = useQuery({
    queryKey: queryKeys.setup.org(),
    queryFn: getOrgSetup,
    enabled: canManageOrg,
  });

  const saveMutation = useMutation({
    mutationFn: async () =>
      saveOrgSetup({
        timezone: setup?.timezone,
        clockInEarlyAllowanceMinutes: setup?.clockInEarlyAllowanceMinutes ?? 5,
        dailyOtcThreshold: setup?.dailyOtcThreshold,
        weeklyOtcThreshold: setup?.weeklyOtcThreshold,
        maxHoursPerWeek: setup?.maxHoursPerWeek,
        schedulingMode: setup?.schedulingMode,
        aiAutoScheduleEnabled: setup?.aiAutoScheduleEnabled ?? false,
        businessHours,
        defaultShiftTemplates: templates,
      }),
    onSuccess: () => {
      setFeedback('Settings saved.');
      queryClient.invalidateQueries({ queryKey: queryKeys.setup.org() });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Failed to save settings';
      setFeedback(message);
    },
  });

  useEffect(() => {
    if (!setup) return;

    const sortedHours = [...setup.businessHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    setBusinessHours(
      sortedHours.length > 0
        ? sortedHours
        : dayNames.map((_, dayOfWeek) => ({
            dayOfWeek,
            openTime: dayOfWeek === 0 || dayOfWeek === 6 ? null : '09:00',
            closeTime: dayOfWeek === 0 || dayOfWeek === 6 ? null : '17:00',
            isClosed: dayOfWeek === 0 || dayOfWeek === 6,
          }))
    );

    setTemplates(
      setup.defaultShiftTemplates.length > 0
        ? setup.defaultShiftTemplates
        : [
            {
              name: 'Morning Shift',
              dayOfWeek: 1,
              startTime: '09:00',
              endTime: '17:00',
              breakDurationMinutes: 30,
              requiredHeadcount: 1,
              active: true,
            },
          ]
    );
  }, [setup]);

  const sortedTemplates = useMemo(
    () =>
      templates
        .map((template, originalIndex) => ({ template, originalIndex }))
        .sort(
          (a, b) =>
            a.template.dayOfWeek - b.template.dayOfWeek ||
            a.template.startTime.localeCompare(b.template.startTime)
        ),
    [templates]
  );

  if (!canManageOrg) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              Only managers and admins can edit organization hours and default shifts.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-4 sm:space-y-6">
      <div className="mb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500">
            Edit business open hours and default shifts used by scheduling.
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>

      {feedback && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
          {feedback}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Business Open Hours</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-slate-500">Loading open hours...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {businessHours.map((hour, index) => (
                <div key={`hour-${hour.dayOfWeek}`} className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <div className="font-semibold text-sm text-slate-800">{dayNames[hour.dayOfWeek]}</div>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={hour.isClosed}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setBusinessHours((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index
                              ? {
                                  ...row,
                                  isClosed: checked,
                                  openTime: checked ? null : row.openTime ?? '09:00',
                                  closeTime: checked ? null : row.closeTime ?? '17:00',
                                }
                              : row
                          )
                        );
                      }}
                    />
                    Closed
                  </label>
                  {!hour.isClosed && (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={hour.openTime ?? '09:00'}
                        className="border border-slate-300 rounded px-2 py-1 text-sm w-full"
                        onChange={(e) => {
                          const value = e.target.value;
                          setBusinessHours((current) =>
                            current.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, openTime: value } : row
                            )
                          );
                        }}
                      />
                      <span className="text-slate-400">to</span>
                      <input
                        type="time"
                        value={hour.closeTime ?? '17:00'}
                        className="border border-slate-300 rounded px-2 py-1 text-sm w-full"
                        onChange={(e) => {
                          const value = e.target.value;
                          setBusinessHours((current) =>
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
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Default Shifts</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setTemplates((current) => [
                ...current,
                {
                  name: `Shift ${current.length + 1}`,
                  dayOfWeek: 1,
                  startTime: '09:00',
                  endTime: '17:00',
                  breakDurationMinutes: 30,
                  requiredHeadcount: 1,
                  active: true,
                },
              ])
            }
          >
            Add Shift
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedTemplates.map(({ template, originalIndex }) => {
            const uniqueKey = template.id ? `template-${template.id}` : `new-${originalIndex}`;
            return (
              <div key={uniqueKey} className="grid grid-cols-1 lg:grid-cols-12 gap-2 rounded-lg border border-slate-200 p-3">
                <input
                  className="border border-slate-300 rounded px-2 py-1 text-sm lg:col-span-3"
                  value={template.name}
                  placeholder="Shift name"
                  onChange={(e) => {
                    const value = e.target.value;
                    setTemplates((current) => {
                      return current.map((row, rowIndex) =>
                        rowIndex === originalIndex ? { ...row, name: value } : row
                      );
                    });
                  }}
                />
                <div className="lg:col-span-2">
                  <Select
                    options={dayNames.map((day, dayOfWeek) => ({ value: String(dayOfWeek), label: day }))}
                    value={String(template.dayOfWeek)}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setTemplates((current) => {
                        return current.map((row, rowIndex) =>
                          rowIndex === originalIndex ? { ...row, dayOfWeek: value } : row
                        );
                      });
                    }}
                  />
                </div>
                <input
                  type="time"
                  className="border border-slate-300 rounded px-2 py-1 text-sm lg:col-span-2"
                  value={template.startTime}
                  onChange={(e) => {
                    const value = e.target.value;
                    setTemplates((current) => {
                      return current.map((row, rowIndex) =>
                        rowIndex === originalIndex ? { ...row, startTime: value } : row
                      );
                    });
                  }}
                />
                <input
                  type="time"
                  className="border border-slate-300 rounded px-2 py-1 text-sm lg:col-span-2"
                  value={template.endTime}
                  onChange={(e) => {
                    const value = e.target.value;
                    setTemplates((current) => {
                      return current.map((row, rowIndex) =>
                        rowIndex === originalIndex ? { ...row, endTime: value } : row
                      );
                    });
                  }}
                />
                <input
                  type="number"
                  min={0}
                  className="border border-slate-300 rounded px-2 py-1 text-sm lg:col-span-1"
                  value={template.breakDurationMinutes ?? 0}
                  onChange={(e) => {
                    const value = Number(e.target.value) || 0;
                    setTemplates((current) => {
                      return current.map((row, rowIndex) =>
                        rowIndex === originalIndex ? { ...row, breakDurationMinutes: value } : row
                      );
                    });
                  }}
                  title="Break (minutes)"
                />
                <input
                  type="number"
                  min={1}
                  className="border border-slate-300 rounded px-2 py-1 text-sm lg:col-span-1"
                  value={template.requiredHeadcount ?? 1}
                  onChange={(e) => {
                    const value = Math.max(Number(e.target.value) || 1, 1);
                    setTemplates((current) => {
                      return current.map((row, rowIndex) =>
                        rowIndex === originalIndex ? { ...row, requiredHeadcount: value } : row
                      );
                    });
                  }}
                  title="Headcount"
                />
                <div className="lg:col-span-1 flex items-center justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setTemplates((current) => current.filter((_, rowIndex) => rowIndex !== originalIndex))}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} isLoading={saveMutation.isPending}>
          Save Settings
        </Button>
      </div>
    </div>
  );
};

export default Settings;
