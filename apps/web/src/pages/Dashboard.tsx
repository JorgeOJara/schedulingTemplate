import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { queryKeys } from '../hooks/useQueryKeys';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { getOrgWeeklyHoursComparison } from '../services/timeClockService';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Users, Clock, Calendar, TrendingUp } from 'lucide-react';

interface WeeklySummary {
  scheduleWeekId: string;
  totalShifts: number;
  totalScheduledHours: number;
  overtimeHours: number;
  regularHours: number;
  scheduledEmployees: number;
  pendingTimeOff: number;
  pendingSwaps: number;
  openShifts: number;
  departmentShifts: Record<string, number>;
  totalEmployees: number;
  actualWorkedHours: number;
  lateClockIns: number;
}

interface ScheduleWeek {
  id: string;
  startDate: string;
  endDate: string;
  state: string;
}

interface DepartmentData {
  name: string;
  value: number;
}

interface TimeSeriesData {
  name: string;
  scheduled: number;
  open: number;
}

const fetchScheduleWeeks = async (): Promise<ScheduleWeek[]> => {
  const response = await api.get('/schedules/week');
  return response.data;
};

const fetchWeeklySummary = async (weekId?: string): Promise<WeeklySummary> => {
  const response = await api.get('/analytics/weekly-summary', {
    params: weekId ? { weekId } : undefined,
  });
  return response.data;
};

export const Dashboard = () => {
  const navigate = useNavigate();
  const [selectedWeekId, setSelectedWeekId] = useState<string>('');

  const { data: weeks = [] } = useQuery({
    queryKey: queryKeys.schedules.week('list'),
    queryFn: fetchScheduleWeeks,
  });

  const { data: summary, isLoading, error } = useQuery({
    queryKey: queryKeys.analytics.summary(selectedWeekId),
    queryFn: () => fetchWeeklySummary(selectedWeekId),
    enabled: Boolean(selectedWeekId),
  });

  const { data: hoursComparison } = useQuery({
    queryKey: queryKeys.analytics.hoursComparison(selectedWeekId),
    queryFn: () => getOrgWeeklyHoursComparison(selectedWeekId),
    enabled: Boolean(selectedWeekId),
  });

  useEffect(() => {
    if (weeks.length === 0) return;
    const now = new Date().getTime();
    const sorted = [...weeks].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const current =
      sorted.find((week) => {
        const start = new Date(week.startDate).getTime();
        const end = new Date(week.endDate).getTime();
        return start <= now && now < end;
      }) ?? sorted[sorted.length - 1];

    const selectedStillExists = selectedWeekId && sorted.some((week) => week.id === selectedWeekId);
    if (!selectedStillExists) {
      setSelectedWeekId(current.id);
    }
  }, [weeks, selectedWeekId]);

  const handleExportHours = async () => {
    const blob = await getOrgWeeklyHoursComparison(selectedWeekId || undefined, true);
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `hours-comparison-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  };

  const pendingCount = (summary?.pendingTimeOff ?? 0) + (summary?.pendingSwaps ?? 0);
  const assignedShifts = Math.max((summary?.totalShifts ?? 0) - (summary?.openShifts ?? 0), 0);

  const deptData: DepartmentData[] = summary?.departmentShifts
    ? Object.entries(summary.departmentShifts).map(([dept, count]) => ({
        name: `Dept ${dept.slice(0, 8)}...`,
        value: count,
      }))
    : [];

  const timeSeriesData: TimeSeriesData[] = useMemo(
    () => [
      { name: 'Mon', scheduled: summary?.totalShifts ? Math.floor(summary.totalShifts / 7) : 0, open: summary?.openShifts ? Math.floor(summary.openShifts / 7) : 0 },
      { name: 'Tue', scheduled: summary?.totalShifts ? Math.floor(summary.totalShifts / 7) : 0, open: summary?.openShifts ? Math.floor(summary.openShifts / 7) : 0 },
      { name: 'Wed', scheduled: summary?.totalShifts ? Math.floor(summary.totalShifts / 7) : 0, open: summary?.openShifts ? Math.floor(summary.openShifts / 7) : 0 },
      { name: 'Thu', scheduled: summary?.totalShifts ? Math.floor(summary.totalShifts / 7) : 0, open: summary?.openShifts ? Math.floor(summary.openShifts / 7) : 0 },
      { name: 'Fri', scheduled: summary?.totalShifts ? Math.floor(summary.totalShifts / 7) : 0, open: summary?.openShifts ? Math.floor(summary.openShifts / 7) : 0 },
      { name: 'Sat', scheduled: summary?.totalShifts ? Math.floor(summary.totalShifts / 14) : 0, open: summary?.openShifts ? Math.floor(summary.openShifts / 14) : 0 },
      { name: 'Sun', scheduled: summary?.totalShifts ? Math.floor(summary.totalShifts / 14) : 0, open: summary?.openShifts ? Math.floor(summary.openShifts / 14) : 0 },
    ],
    [summary]
  );

  const statusData = [
    { name: 'Assigned', value: assignedShifts, color: '#10b981' },
    { name: 'Open', value: summary?.openShifts ?? 0, color: '#f59e0b' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    console.error('Failed to load dashboard:', error);
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-sm text-slate-500">Overview of your organization's scheduling activity</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="min-w-[220px]">
            <Select
              options={
                weeks.map((week) => ({
                  value: week.id,
                  label: `${new Date(week.startDate).toLocaleDateString()} - ${new Date(week.endDate).toLocaleDateString()}`,
                })) || []
              }
              value={selectedWeekId}
              onChange={(e) => setSelectedWeekId(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => navigate('/scheduler')}
            className="flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            Go to Scheduler
          </Button>
          <Button variant="secondary" onClick={handleExportHours}>
            Export Hours CSV
          </Button>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start">
            <div className="p-3 bg-blue-100 rounded-lg mr-3 sm:mr-4 mt-1">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Pending Actions</h3>
              <p className="text-sm text-slate-600">
                {summary?.pendingTimeOff && summary.pendingTimeOff > 0
                  ? `${summary.pendingTimeOff} time off request${summary.pendingTimeOff !== 1 ? 's' : ''} `
                  : ''}pending review
              </p>
            </div>
          </div>
          <Button onClick={() => navigate('/requests')}>Review All</Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Shifts</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{summary?.totalShifts ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">All shifts this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{summary?.totalScheduledHours?.toFixed(1) ?? '0.0'}</div>
            <p className="text-xs text-slate-500 mt-1">
              Regular: {summary?.regularHours?.toFixed(1) ?? '0.0'}h | OT: {summary?.overtimeHours?.toFixed(1) ?? '0.0'}h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Coverage</CardTitle>
            <Users className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{summary?.scheduledEmployees ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">Employees scheduled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Open Shifts</CardTitle>
            <Calendar className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{summary?.openShifts ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">Unassigned shifts this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Actual Worked</CardTitle>
            <Clock className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{summary?.actualWorkedHours?.toFixed(1) ?? '0.0'}h</div>
            <p className="text-xs text-slate-500 mt-1">
              Scheduled: {summary?.totalScheduledHours?.toFixed(1) ?? '0.0'}h
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Shift Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Weekly Shift Pattern</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeriesData}>
                  <Line type="monotone" dataKey="scheduled" stroke="#3b82f6" strokeWidth={2} name="Scheduled" />
                  <Line type="monotone" dataKey="open" stroke="#f59e0b" strokeWidth={2} name="Open" />
                  <Tooltip />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {deptData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Department Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData}>
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Tooltip />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Scheduled vs Actual Hours (This Week)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200">
                  <th className="py-2 pr-3">Employee</th>
                  <th className="py-2 pr-3">Scheduled</th>
                  <th className="py-2 pr-3">Actual</th>
                  <th className="py-2 pr-3">Diff</th>
                  <th className="py-2 pr-3">Late</th>
                </tr>
              </thead>
              <tbody>
                {(hoursComparison?.employees ?? []).length > 0 ? (
                  (hoursComparison?.employees ?? []).slice(0, 10).map((employee: any) => (
                    <tr key={employee.employeeId} className="border-b border-slate-100">
                      <td className="py-2 pr-3">{employee.employeeName}</td>
                      <td className="py-2 pr-3">{employee.scheduledHours}h</td>
                      <td className="py-2 pr-3">{employee.actualHours}h</td>
                      <td className="py-2 pr-3">{employee.differenceHours}h</td>
                      <td className="py-2 pr-3">{employee.lateClockIns}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-500">
                      No scheduled/actual hour data for this week yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
