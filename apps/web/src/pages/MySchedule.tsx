import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isToday, startOfDay, endOfDay, addDays } from 'date-fns';
import { Calendar, Clock, MapPin, Briefcase, CalendarPlus, ArrowLeftRight } from 'lucide-react';
import axios from 'axios';
import api from '../services/api';
import { queryKeys } from '../hooks/useQueryKeys';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Input } from '../components/ui/Input';
import { clockIn, clockOut, getClockStatus } from '../services/timeClockService';
import Modal from '../components/ui/Modal';

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

interface Peer {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

const scheduleRangeStart = startOfDay(new Date());
const scheduleRangeEnd = endOfDay(addDays(new Date(), 30));

const fetchMySchedule = async ({ queryKey }: { queryKey: [string, string, string, string] }): Promise<Shift[]> => {
  const [, , startDate, endDate] = queryKey;
  const response = await api.get('/schedules/my-schedule', {
    params: { startDate, endDate },
  });
  return response.data;
};

const fetchPeers = async (): Promise<Peer[]> => {
  const response = await api.get('/users/peers');
  return response.data;
};

export const MySchedule = () => {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<Date | null>(null);
  const [isTimeOffModalOpen, setIsTimeOffModalOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);

  const [timeOffType, setTimeOffType] = useState('VACATION');
  const [timeOffReason, setTimeOffReason] = useState('');

  const [responderId, setResponderId] = useState('');
  const [myShiftId, setMyShiftId] = useState('');
  const [requestedShiftId, setRequestedShiftId] = useState('');
  const [swapReason, setSwapReason] = useState('');

  const { data: shifts = [], isLoading, error } = useQuery({
    queryKey: queryKeys.schedules.mySchedule(scheduleRangeStart.toISOString(), scheduleRangeEnd.toISOString()) as [
      string,
      string,
      string,
      string
    ],
    queryFn: fetchMySchedule,
  });

  const { data: peers = [] } = useQuery({
    queryKey: ['users', 'peers'],
    queryFn: fetchPeers,
  });

  const { data: peerShifts = [] } = useQuery<Shift[]>({
    queryKey: ['schedules', 'peer', responderId, activeDay?.toISOString() ?? ''],
    queryFn: async () => {
      if (!activeDay) return [];
      const response = await api.get(`/schedules/employee/${responderId}`, {
        params: {
          startDate: startOfDay(activeDay).toISOString(),
          endDate: endOfDay(activeDay).toISOString(),
        },
      });
      return response.data;
    },
    enabled: Boolean(responderId && activeDay),
  });

  const { data: clockStatus } = useQuery({
    queryKey: queryKeys.timeClock.status(),
    queryFn: getClockStatus,
    refetchInterval: 30_000,
  });

  const clockInMutation = useMutation({
    mutationFn: async (payload?: { shiftId?: string; force?: boolean }) =>
      clockIn(payload?.shiftId, payload?.force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timeClock.status() });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeClock.myWeek() });
    },
    onError: (error) => {
      if (axios.isAxiosError(error)) {
        setErrorMessage(error.response?.data?.error || 'Unable to clock in. Please try again.');
        return;
      }
      setErrorMessage('Unable to clock in. Please try again.');
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async (shiftId?: string) => clockOut({ shiftId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timeClock.status() });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeClock.myWeek() });
    },
    onError: (error) => {
      if (axios.isAxiosError(error)) {
        setErrorMessage(error.response?.data?.error || 'Unable to clock out. Please try again.');
        return;
      }
      setErrorMessage('Unable to clock out. Please try again.');
    },
  });

  const timeOffMutation = useMutation({
    mutationFn: async () =>
      api.post('/time-off', {
        startDate: activeDay ? new Date(activeDay).toISOString() : '',
        endDate: activeDay ? new Date(activeDay).toISOString() : '',
        type: timeOffType,
        reason: timeOffReason,
      }),
    onSuccess: () => {
      setTimeOffReason('');
      setIsTimeOffModalOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount('me') });
    },
  });

  const shiftSwapMutation = useMutation({
    mutationFn: async () =>
      api.post('/shift-swaps', {
        responderId,
        proposedShiftIds: [myShiftId],
        requestedShiftIds: [requestedShiftId],
        type: 'DIRECT_SWAP',
        reason: swapReason,
      }),
    onSuccess: () => {
      setResponderId('');
      setMyShiftId('');
      setRequestedShiftId('');
      setSwapReason('');
      setIsSwapModalOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount('me') });
    },
  });

  const scheduledDays = useMemo(() => {
    const unique = new Map<string, Date>();
    for (const shift of shifts) {
      const day = startOfDay(new Date(shift.startTime));
      if (day < scheduleRangeStart) continue;
      const key = day.toISOString();
      if (!unique.has(key)) unique.set(key, day);
    }
    return Array.from(unique.values()).sort((a, b) => a.getTime() - b.getTime());
  }, [shifts]);

  const getShiftsForDay = (date: Date) =>
    shifts.filter((shift) => new Date(shift.startTime).toDateString() === date.toDateString());

  const formatTime = (time: string) => format(new Date(time), 'h:mm a');
  const canSubmitTimeOff = Boolean(activeDay);
  const canSubmitSwap = Boolean(responderId && myShiftId && requestedShiftId && swapReason.trim());

  const openTimeOffModalForDay = (day: Date) => {
    setActiveDay(day);
    setIsTimeOffModalOpen(true);
  };

  const openSwapModalForDay = (day: Date) => {
    setActiveDay(day);
    setResponderId('');
    setMyShiftId('');
    setRequestedShiftId('');
    setSwapReason('');
    setIsSwapModalOpen(true);
  };

  const activeDayShifts = activeDay ? getShiftsForDay(activeDay) : [];
  const activeDayPeerShifts = activeDay
    ? peerShifts.filter((shift) => new Date(shift.startTime).toDateString() === activeDay.toDateString())
    : [];

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
      <div>
        <h2 className="text-2xl font-bold text-slate-900">My Schedule</h2>
        <p className="text-sm text-slate-500 mt-1">Only upcoming scheduled workdays are shown</p>
      </div>

      {scheduledDays.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-slate-500">No upcoming scheduled workdays.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {scheduledDays.map((day) => {
            const dayShifts = getShiftsForDay(day);
            const isTodayShift = isToday(day);
            const eligibleShift = clockStatus?.eligibleShift;
            const eligibleShiftIsForDay =
              Boolean(eligibleShift) && new Date(eligibleShift!.startTime).toDateString() === day.toDateString();

            const activeEntry = clockStatus?.activeEntry;
            const activeEntryDaySource = activeEntry?.shift?.startTime || activeEntry?.clockInAt;
            const activeEntryIsForDay =
              Boolean(activeEntryDaySource) &&
              new Date(activeEntryDaySource).toDateString() === day.toDateString();
            const canClockForDay = isTodayShift && !clockStatus?.activeEntry;

            return (
              <Card key={day.toISOString()}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className={`flex items-center gap-2 ${isTodayShift ? 'text-blue-700' : ''}`}>
                      <Calendar className="w-5 h-5" />
                      {format(day, 'EEEE, PP, yyyy')}
                      {isTodayShift && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-semibold">
                          Today
                        </span>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="!p-2"
                        onClick={() => openTimeOffModalForDay(day)}
                        title="Request time off"
                      >
                        <CalendarPlus className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="!p-2"
                        onClick={() => openSwapModalForDay(day)}
                        title="Request shift swap"
                      >
                        <ArrowLeftRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
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
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100/50">
                          <div className="text-xs text-slate-500">
                            {activeEntryIsForDay && activeEntry?.shiftId === shift.id
                              ? 'Currently clocked in'
                              : eligibleShiftIsForDay && eligibleShift?.id === shift.id && !eligibleShift.canClockIn && clockStatus?.earliestClockInAt
                              ? `Clock in at ${format(new Date(clockStatus.earliestClockInAt), 'h:mm a')}`
                              : !isTodayShift
                              ? 'Clock-in available on shift day'
                              : 'Scheduled shift'}
                          </div>
                          {activeEntryIsForDay && activeEntry?.shiftId === shift.id ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => clockOutMutation.mutate(shift.id)}
                              isLoading={clockOutMutation.isPending}
                            >
                              Clock Out
                            </Button>
                          ) : canClockForDay ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                eligibleShiftIsForDay && eligibleShift?.id === shift.id && eligibleShift.canClockIn
                                  ? clockInMutation.mutate({ shiftId: shift.id })
                                  : clockInMutation.mutate({ force: true })
                              }
                              isLoading={clockInMutation.isPending}
                            >
                              {eligibleShiftIsForDay && eligibleShift?.id === shift.id && eligibleShift.canClockIn
                                ? 'Clock In'
                                : 'Clock In Now'}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={isTimeOffModalOpen}
        onClose={() => setIsTimeOffModalOpen(false)}
        title={`Request Time Off${activeDay ? ` - ${format(activeDay, 'EEE, MMM d')}` : ''}`}
        action={
          <>
            <Button variant="outline" onClick={() => setIsTimeOffModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => timeOffMutation.mutate()}
              disabled={!canSubmitTimeOff}
              isLoading={timeOffMutation.isPending}
            >
              Submit Request
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select
            value={timeOffType}
            onChange={(e) => setTimeOffType(e.target.value)}
            options={[
              { value: 'VACATION', label: 'Vacation' },
              { value: 'SICK', label: 'Sick' },
              { value: 'PERSONAL', label: 'Personal' },
            ]}
          />
          {activeDay && (
            <div className="text-sm text-slate-600">
              Requesting day off for <span className="font-semibold text-slate-900">{format(activeDay, 'EEEE, MMM d, yyyy')}</span>.
            </div>
          )}
          <Input
            placeholder="Reason for time off (optional)"
            value={timeOffReason}
            onChange={(e) => setTimeOffReason(e.target.value)}
          />
          {timeOffMutation.isError && (
            <div className="text-sm text-red-600">Unable to submit time-off request.</div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isSwapModalOpen}
        onClose={() => setIsSwapModalOpen(false)}
        title={`Request Shift Swap${activeDay ? ` - ${format(activeDay, 'EEE, MMM d')}` : ''}`}
        action={
          <>
            <Button variant="outline" onClick={() => setIsSwapModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => shiftSwapMutation.mutate()}
              disabled={!canSubmitSwap}
              isLoading={shiftSwapMutation.isPending}
            >
              Send Request
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select
            value={myShiftId}
            onChange={(e) => setMyShiftId(e.target.value)}
            options={[
              { value: '', label: 'Select your shift for this day' },
              ...activeDayShifts.map((shift) => ({
                value: shift.id,
                label: `${format(new Date(shift.startTime), 'h:mm a')} - ${format(new Date(shift.endTime), 'h:mm a')}`,
              })),
            ]}
          />
          <Select
            value={responderId}
            onChange={(e) => {
              setResponderId(e.target.value);
              setRequestedShiftId('');
            }}
            options={[
              { value: '', label: 'Select same-role coworker' },
              ...peers.map((peer) => ({ value: peer.id, label: `${peer.firstName} ${peer.lastName}` })),
            ]}
          />
          <Select
            value={requestedShiftId}
            onChange={(e) => setRequestedShiftId(e.target.value)}
            options={[
              { value: '', label: responderId ? 'Select coworker shift for this day' : 'Pick coworker first' },
              ...activeDayPeerShifts.map((shift) => ({
                value: shift.id,
                label: `${format(new Date(shift.startTime), 'h:mm a')} - ${format(new Date(shift.endTime), 'h:mm a')}`,
              })),
            ]}
          />
          <Input
            placeholder="Why do you need this swap?"
            value={swapReason}
            onChange={(e) => setSwapReason(e.target.value)}
          />
          {shiftSwapMutation.isError && (
            <div className="text-sm text-red-600">Unable to submit shift-swap request.</div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(errorMessage)}
        onClose={() => setErrorMessage(null)}
        title="Clock Error"
        action={<Button onClick={() => setErrorMessage(null)}>OK</Button>}
      >
        <p className="text-sm text-slate-700">{errorMessage}</p>
      </Modal>
    </div>
  );
};

export default MySchedule;
