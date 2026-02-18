import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, addDays, startOfWeek, endOfWeek, getDay, isToday } from 'date-fns';
import { Calendar, Clock, MapPin, Briefcase, Timer, ChevronRight } from 'lucide-react';
import api from '../services/api';
import { queryKeys } from '../hooks/useQueryKeys';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { clockIn, clockOut, getClockStatus } from '../services/timeClockService';

interface Shift {
  id: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  isOnCall: boolean;
  employeeId: string | null;
  department: { name: string } | null;
  location: { name: string } | null;
}

interface MyScheduleQuery {
  queryKey: [string, string, string, string];
}

const fetchMySchedule = async ({ queryKey }: MyScheduleQuery): Promise<Shift[]> => {
  const [, , startDate, endDate] = queryKey;
  const response = await api.get('/schedules/my-schedule', {
    params: { startDate, endDate },
  });
  return response.data;
};

export const MySchedule = () => {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);

  const { data: shifts = [], isLoading, error } = useQuery({
    queryKey: queryKeys.schedules.mySchedule(weekStart.toISOString(), weekEnd.toISOString()) as [
      string,
      string,
      string,
      string
    ],
    queryFn: fetchMySchedule,
  });

  const { data: clockStatus } = useQuery({
    queryKey: queryKeys.timeClock.status(),
    queryFn: getClockStatus,
    refetchInterval: 30_000,
  });

  const clockInMutation = useMutation({
    mutationFn: async (shiftId?: string) => clockIn(shiftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timeClock.status() });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeClock.myWeek() });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async (shiftId?: string) => clockOut({ shiftId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timeClock.status() });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeClock.myWeek() });
    },
  });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const eligibleShift = clockStatus?.eligibleShift ?? null;

  const getShiftsForDay = (date: Date) =>
    shifts.filter((shift) => new Date(shift.startTime).toDateString() === date.toDateString());

  const formatTime = (time: string) => format(new Date(time), 'h:mm a');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-600">
        Failed to load schedule. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">My Schedule</h2>
          <p className="text-sm text-slate-500 mt-1">View shifts and track your time</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center space-x-1.5 sm:space-x-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto">
            <Button
              variant="secondary"
              onClick={() => setCurrentDate(addDays(currentDate, -7))}
              className="w-9 h-9 sm:w-10 sm:h-10 px-0 flex items-center justify-center rounded-lg font-bold text-slate-600 hover:bg-slate-50"
            >
              ←
            </Button>
            <div className="px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-800 min-w-[180px] text-center">
              {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
            </div>
            <Button
              variant="secondary"
              onClick={() => setCurrentDate(addDays(currentDate, 7))}
              className="w-9 h-9 sm:w-10 sm:h-10 px-0 flex items-center justify-center rounded-lg font-bold text-slate-600 hover:bg-slate-50"
            >
              →
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="w-5 h-5" />
            Clock In / Out
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">
            Early clock-in window: {clockStatus?.policy.clockInEarlyAllowanceMinutes ?? 5} minutes before shift start.
          </p>
          {clockStatus?.activeEntry ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <div className="text-sm">
                <div className="font-semibold text-emerald-700">You are clocked in</div>
                <div className="text-slate-600">
                  Since {format(new Date(clockStatus.activeEntry.clockInAt), 'h:mm a')}
                </div>
              </div>
              <Button
                onClick={() => clockOutMutation.mutate(clockStatus.activeEntry.shiftId)}
                isLoading={clockOutMutation.isPending}
              >
                Clock Out
              </Button>
            </div>
          ) : eligibleShift ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <div className="text-sm">
                <div className="font-semibold text-slate-900">Next shift</div>
                <div className="text-slate-600">
                  {format(new Date(eligibleShift.startTime), 'EEE h:mm a')} -{' '}
                  {format(new Date(eligibleShift.endTime), 'h:mm a')}
                </div>
                {!eligibleShift.canClockIn && clockStatus.earliestClockInAt && (
                  <div className="text-amber-700">
                    You can clock in at {format(new Date(clockStatus.earliestClockInAt), 'h:mm a')}
                  </div>
                )}
              </div>
              <Button
                onClick={() => clockInMutation.mutate(eligibleShift.id)}
                isLoading={clockInMutation.isPending}
                disabled={!eligibleShift.canClockIn}
              >
                Clock In
              </Button>
            </div>
          ) : (
            <div className="text-sm text-slate-500">No upcoming assigned shift eligible for clock-in.</div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {days.map((day) => {
          const dayShifts = getShiftsForDay(day);
          const isWeekend = getDay(day) === 0 || getDay(day) === 6;
          const isTodayShift = isToday(day);

          return (
            <Card key={day.toISOString()} className={isWeekend ? 'border-indigo-100' : ''}>
              <CardHeader>
                <CardTitle className={`flex items-center gap-2 ${isTodayShift ? 'text-blue-700' : ''}`}>
                  <Calendar className="w-5 h-5" />
                  {format(day, 'EEEE, PP, yyyy')}
                  {isTodayShift && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-semibold">
                      Today
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dayShifts.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    {isWeekend ? 'Rest day' : 'No shifts scheduled'}
                  </div>
                ) : (
                   <div className="space-y-3">
                     {dayShifts.map((shift) => (
                       <div
                         key={shift.id}
                         className="group p-4 rounded-xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 hover:border-blue-300 hover:shadow-md hover:shadow-blue-500/5 transition-all cursor-pointer"
                       >
                         <div className="flex items-center justify-between mb-3">
                           <div className="flex items-center gap-3">
                             <div className="flex flex-col items-center justify-center min-w-[70px] h-12 rounded-lg bg-slate-100 group-hover:bg-blue-50 transition-colors">
                               <span className="text-base font-bold text-slate-900 group-hover:text-blue-700">{formatTime(shift.startTime)}</span>
                               <span className="text-xs text-slate-500 group-hover:text-blue-600">{formatTime(shift.endTime)}</span>
                             </div>
                             <div className="space-y-1.5">
                               <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                 <Clock className="w-4 h-4 text-blue-500" />
                                 {shift.shiftType} {shift.isOnCall ? '(On-call)' : ''}
                               </div>
                               {shift.department && (
                                 <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white px-2 py-1 rounded border border-slate-200">
                                   <Briefcase className="w-3 h-3" />
                                   <span className="truncate max-w-[120px]">{shift.department.name}</span>
                                 </div>
                               )}
                               {shift.location && (
                                 <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white px-2 py-1 rounded border border-slate-200">
                                   <MapPin className="w-3 h-3" />
                                   <span className="truncate max-w-[120px]">{shift.location.name}</span>
                                 </div>
                               )}
                             </div>
                           </div>
                           {!clockStatus?.activeEntry && (
                             <Button
                               size="sm"
                               variant="outline"
                               onClick={() => clockInMutation.mutate(shift.id)}
                               isLoading={clockInMutation.isPending}
                               className="px-4"
                             >
                               Clock In
                             </Button>
                           )}
                         </div>
                         <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100/50">
                           <div className="text-xs text-slate-500">Tap to view details</div>
                           <ChevronRight className="w-4 h-4 text-slate-400" />
                         </div>
                       </div>
                     ))}
                   </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default MySchedule;
