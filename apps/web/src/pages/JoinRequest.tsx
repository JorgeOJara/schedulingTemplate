import { useState } from 'react';
import { Check, Search, Users, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPendingEmployees, reviewPendingEmployee } from '../services/authService';
import api from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

interface PendingEmployee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

interface TimeOffRequest {
  id: string;
  startDate: string;
  endDate: string;
  type: string;
  reason: string;
  status: string;
  employee: { firstName: string; lastName: string };
}

interface ShiftSwapRequest {
  id: string;
  requestor: { firstName: string; lastName: string };
  responder: { firstName: string; lastName: string } | null;
  proposedShiftIds: string[];
  requestedShiftIds: string[];
  reason: string;
  status: string;
}

interface OvertimeRequest {
  id: string;
  clockInAt: string;
  clockOutAt: string;
  scheduledEnd: string | null;
  employee: { firstName: string; lastName: string };
}

const fetchTimeOffRequests = async (): Promise<TimeOffRequest[]> => {
  const response = await api.get('/time-off', { params: { status: 'PENDING' } });
  return response.data;
};

const fetchShiftSwapRequests = async (): Promise<ShiftSwapRequest[]> => {
  const response = await api.get('/shift-swaps', { params: { status: 'ACCEPTED' } });
  return response.data;
};

const fetchOvertimeRequests = async (): Promise<OvertimeRequest[]> => {
  const response = await api.get('/time-clock/overtime-requests');
  return response.data;
};

const JoinRequest = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'join' | 'time-off' | 'swaps' | 'overtime'>('join');

  const { data: joinRequests = [], isLoading, error } = useQuery<PendingEmployee[]>({
    queryKey: ['pending-employees'],
    queryFn: getPendingEmployees,
  });

  const { data: timeOffRequests = [] } = useQuery<TimeOffRequest[]>({
    queryKey: ['requests', 'time-off', 'pending'],
    queryFn: fetchTimeOffRequests,
  });

  const { data: shiftSwapRequests = [] } = useQuery<ShiftSwapRequest[]>({
    queryKey: ['requests', 'shift-swaps', 'accepted'],
    queryFn: fetchShiftSwapRequests,
  });

  const { data: overtimeRequests = [] } = useQuery<OvertimeRequest[]>({
    queryKey: ['requests', 'overtime', 'pending'],
    queryFn: fetchOvertimeRequests,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ userId, decision }: { userId: string; decision: 'APPROVE' | 'REJECT' }) =>
      reviewPendingEmployee(userId, decision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-employees'] });
    },
  });

  const approveTimeOffMutation = useMutation({
    mutationFn: (requestId: string) => api.put(`/time-off/${requestId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests', 'time-off', 'pending'] });
    },
  });

  const denyTimeOffMutation = useMutation({
    mutationFn: (requestId: string) => api.put(`/time-off/${requestId}/deny`, { notes: 'Denied by manager review' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests', 'time-off', 'pending'] });
    },
  });

  const approveSwapMutation = useMutation({
    mutationFn: (requestId: string) => api.put(`/shift-swaps/${requestId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests', 'shift-swaps', 'accepted'] });
    },
  });

  const denySwapMutation = useMutation({
    mutationFn: (requestId: string) => api.put(`/shift-swaps/${requestId}/manager-deny`, { notes: 'Denied by manager review' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests', 'shift-swaps', 'accepted'] });
    },
  });

  const approveOvertimeMutation = useMutation({
    mutationFn: (timeEntryId: string) => api.put(`/time-clock/overtime-requests/${timeEntryId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests', 'overtime', 'pending'] });
    },
  });

  const denyOvertimeMutation = useMutation({
    mutationFn: (timeEntryId: string) => api.put(`/time-clock/overtime-requests/${timeEntryId}/deny`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests', 'overtime', 'pending'] });
    },
  });

  const filteredJoinRequests = joinRequests.filter((req) => {
    const fullName = `${req.firstName} ${req.lastName}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) || req.email.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Requests</h2>
        <p className="text-sm text-slate-600">Review join requests, time-off requests, and shift swap approvals.</p>
      </div>

      <div className="flex gap-2">
        <Button variant={activeTab === 'join' ? 'primary' : 'secondary'} onClick={() => setActiveTab('join')}>
          Join ({joinRequests.length})
        </Button>
        <Button variant={activeTab === 'time-off' ? 'primary' : 'secondary'} onClick={() => setActiveTab('time-off')}>
          Time Off ({timeOffRequests.length})
        </Button>
        <Button variant={activeTab === 'swaps' ? 'primary' : 'secondary'} onClick={() => setActiveTab('swaps')}>
          Swaps ({shiftSwapRequests.length})
        </Button>
        <Button variant={activeTab === 'overtime' ? 'primary' : 'secondary'} onClick={() => setActiveTab('overtime')}>
          Overtime ({overtimeRequests.length})
        </Button>
      </div>

      {activeTab === 'join' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="text-sm text-slate-600">Pending requests: {joinRequests.length}</div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-lg border border-slate-300 w-64"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-sm text-slate-600">Loading requests...</div>
          ) : error ? (
            <div className="p-8 text-sm text-red-700">Failed to load join requests.</div>
          ) : filteredJoinRequests.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              No pending requests.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Requested At</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredJoinRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-900">{request.firstName} {request.lastName}</div>
                      <div className="text-sm text-slate-500">{request.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{new Date(request.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => reviewMutation.mutate({ userId: request.id, decision: 'APPROVE' })}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                          disabled={reviewMutation.isPending}
                          title="Approve"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => reviewMutation.mutate({ userId: request.id, decision: 'REJECT' })}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          disabled={reviewMutation.isPending}
                          title="Reject"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'time-off' && (
        <div className="space-y-3">
          {timeOffRequests.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-slate-500">No pending time-off requests.</CardContent>
            </Card>
          ) : (
            timeOffRequests.map((request) => (
              <Card key={request.id}>
                <CardHeader>
                  <CardTitle>
                    {request.employee.firstName} {request.employee.lastName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-slate-600">
                    {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()} ({request.type})
                  </div>
                  <p className="mt-2 text-sm">{request.reason}</p>
                  <div className="mt-4 flex gap-2 justify-end">
                    <Button
                      variant="secondary"
                      onClick={() => denyTimeOffMutation.mutate(request.id)}
                      isLoading={denyTimeOffMutation.isPending}
                    >
                      Deny
                    </Button>
                    <Button onClick={() => approveTimeOffMutation.mutate(request.id)} isLoading={approveTimeOffMutation.isPending}>
                      Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'swaps' && (
        <div className="space-y-3">
          {shiftSwapRequests.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-slate-500">No shift swaps awaiting manager approval.</CardContent>
            </Card>
          ) : (
            shiftSwapRequests.map((request) => (
              <Card key={request.id}>
                <CardHeader>
                  <CardTitle>
                    {request.requestor.firstName} {request.requestor.lastName}
                    {request.responder ? ` ↔ ${request.responder.firstName} ${request.responder.lastName}` : ''}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">{request.reason}</p>
                  <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                    <div>
                      <div className="font-semibold text-slate-700 mb-1">Requestor shifts</div>
                      {request.proposedShiftIds.map((shiftId) => (
                        <div key={shiftId}>Shift {shiftId.slice(-6)}</div>
                      ))}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-700 mb-1">Responder shifts</div>
                      {request.requestedShiftIds.map((shiftId) => (
                        <div key={shiftId}>Shift {shiftId.slice(-6)}</div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2 justify-end">
                    <Button variant="secondary" onClick={() => denySwapMutation.mutate(request.id)} isLoading={denySwapMutation.isPending}>
                      Deny
                    </Button>
                    <Button onClick={() => approveSwapMutation.mutate(request.id)} isLoading={approveSwapMutation.isPending}>
                      Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'overtime' && (
        <div className="space-y-3">
          {overtimeRequests.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-slate-500">No overtime approvals pending.</CardContent>
            </Card>
          ) : (
            overtimeRequests.map((request) => (
              <Card key={request.id}>
                <CardHeader>
                  <CardTitle>
                    {request.employee.firstName} {request.employee.lastName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-slate-600">
                    Clock in: {new Date(request.clockInAt).toLocaleString()}
                  </div>
                  <div className="text-sm text-slate-600">
                    Clock out: {new Date(request.clockOutAt).toLocaleString()}
                  </div>
                  {request.scheduledEnd && (
                    <div className="text-sm text-slate-600">
                      Scheduled end: {new Date(request.scheduledEnd).toLocaleString()}
                    </div>
                  )}
                  <div className="mt-4 flex gap-2 justify-end">
                    <Button
                      variant="secondary"
                      onClick={() => denyOvertimeMutation.mutate(request.id)}
                      isLoading={denyOvertimeMutation.isPending}
                    >
                      Deny
                    </Button>
                    <Button
                      onClick={() => approveOvertimeMutation.mutate(request.id)}
                      isLoading={approveOvertimeMutation.isPending}
                    >
                      Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default JoinRequest;
