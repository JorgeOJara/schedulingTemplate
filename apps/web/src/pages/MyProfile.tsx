import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays, format, startOfWeek } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { queryKeys } from '../hooks/useQueryKeys';
import { getMyWeeklyHours } from '../services/timeClockService';

const MyProfile = () => {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.timeClock.myWeek(weekStart.toISOString()),
    queryFn: () => getMyWeeklyHours(weekStart.toISOString()),
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">My Profile</h2>
          <p className="text-sm text-slate-500">Weekly worked hours and attendance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            Previous Week
          </Button>
          <Button variant="secondary" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            Next Week
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">Scheduled Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {isLoading ? '...' : `${data?.scheduledHours ?? 0}h`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">Actual Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">
              {isLoading ? '...' : `${data?.actualHours ?? 0}h`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">Difference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {isLoading ? '...' : `${data?.differenceHours ?? 0}h`}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Clock Records ({format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Clock In</th>
                  <th className="py-2 pr-4">Clock Out</th>
                  <th className="py-2 pr-4">Late</th>
                </tr>
              </thead>
              <tbody>
                {(data?.entries ?? []).map((entry: any) => (
                  <tr key={entry.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{format(new Date(entry.clockInAt), 'EEE MMM d')}</td>
                    <td className="py-2 pr-4">{format(new Date(entry.clockInAt), 'h:mm a')}</td>
                    <td className="py-2 pr-4">
                      {entry.clockOutAt ? format(new Date(entry.clockOutAt), 'h:mm a') : '--'}
                    </td>
                    <td className="py-2 pr-4">
                      {entry.isLate ? `${entry.lateByMinutes} min` : 'No'}
                    </td>
                  </tr>
                ))}
                {(data?.entries ?? []).length === 0 && !isLoading && (
                  <tr>
                    <td className="py-4 text-slate-500" colSpan={4}>
                      No clock records for this week.
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

export default MyProfile;
