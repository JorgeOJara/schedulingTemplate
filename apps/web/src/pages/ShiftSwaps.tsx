import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { useAuthStore } from '../store/authStore';

interface ShiftSwapRequest {
  id: string;
  requestorId: string;
  responderId: string | null;
  requestor: { firstName: string; lastName: string };
  responder: { firstName: string; lastName: string } | null;
  proposedShiftIds: string[];
  requestedShiftIds: string[];
  reason: string;
  status: string;
}

const fetchOrgShiftSwapRequests = async (statusFilter: string): Promise<ShiftSwapRequest[]> => {
  const response = await api.get('/shift-swaps', {
    params: statusFilter === 'all' ? undefined : { status: statusFilter },
  });
  return response.data;
};

const fetchMyShiftSwapRequests = async (): Promise<ShiftSwapRequest[]> => {
  const response = await api.get('/shift-swaps/my-requests');
  return response.data;
};

export const ShiftSwaps = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('ACCEPTED');
  const { user } = useAuthStore();
  const isManager = ['ADMIN', 'MANAGER'].includes(user?.role ?? '');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['shift-swaps', isManager ? 'org' : 'mine', statusFilter],
    queryFn: () => (isManager ? fetchOrgShiftSwapRequests(statusFilter) : fetchMyShiftSwapRequests()),
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await api.put(`/shift-swaps/${requestId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-swaps'] });
    },
  });

  const managerDenyMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await api.put(`/shift-swaps/${requestId}/manager-deny`, { notes: 'Denied by manager review' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-swaps'] });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await api.put(`/shift-swaps/${requestId}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-swaps'] });
    },
  });

  const denyMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await api.put(`/shift-swaps/${requestId}/deny`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-swaps'] });
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading swap requests...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          {isManager ? 'Shift Swap Approvals' : 'My Shift Swap Requests'}
        </h2>
        {isManager && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select
              options={[
                { value: 'all', label: 'All Requests' },
                { value: 'PENDING', label: 'Pending coworker response' },
                { value: 'ACCEPTED', label: 'Awaiting manager decision' },
                { value: 'APPROVED', label: 'Approved' },
                { value: 'DENIED', label: 'Denied' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="space-y-3 sm:space-y-4">
        {requests.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-slate-500">No shift swap requests found.</CardContent>
          </Card>
        ) : (
          requests.map((request) => {
            const iAmResponder = request.responderId === user?.id;
            const canRespond = !isManager && iAmResponder && request.status === 'PENDING';
            const canManagerDecide = isManager && request.status === 'ACCEPTED';

            return (
              <Card key={request.id}>
                <CardHeader>
                  <CardTitle className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <div>
                      <span className="text-base sm:text-lg font-medium">
                        {request.requestor.firstName} {request.requestor.lastName}
                        {request.responder ? ` ↔ ${request.responder.firstName} ${request.responder.lastName}` : ''}
                      </span>
                      <span
                        className={`ml-0 sm:ml-3 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          request.status === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-800'
                            : request.status === 'ACCEPTED'
                            ? 'bg-blue-100 text-blue-800'
                            : request.status === 'APPROVED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {request.status}
                      </span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-3 sm:mb-4">
                    <span className="block text-sm font-medium text-slate-700 mb-1">Reason</span>
                    <p className="text-sm text-slate-600">{request.reason}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-6 mb-3 sm:mb-4">
                    <div className="p-2 sm:p-3 bg-blue-50 rounded-lg">
                      <span className="block text-sm font-semibold text-blue-800 mb-2">Requestor shift(s):</span>
                      <ul className="text-sm text-slate-700 space-y-1">
                        {request.proposedShiftIds.map((shiftId) => (
                          <li key={shiftId}>Shift {shiftId.slice(-6)}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-2 sm:p-3 bg-green-50 rounded-lg">
                      <span className="block text-sm font-semibold text-green-800 mb-2">Responder shift(s):</span>
                      <ul className="text-sm text-slate-700 space-y-1">
                        {request.requestedShiftIds.map((shiftId) => (
                          <li key={shiftId}>Shift {shiftId.slice(-6)}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {canRespond && (
                    <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3">
                      <Button variant="secondary" onClick={() => denyMutation.mutate(request.id)} isLoading={denyMutation.isPending}>
                        Decline
                      </Button>
                      <Button onClick={() => acceptMutation.mutate(request.id)} isLoading={acceptMutation.isPending}>
                        Accept and Send to Manager
                      </Button>
                    </div>
                  )}

                  {canManagerDecide && (
                    <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3">
                      <Button
                        variant="secondary"
                        onClick={() => managerDenyMutation.mutate(request.id)}
                        isLoading={managerDenyMutation.isPending}
                      >
                        Deny
                      </Button>
                      <Button onClick={() => approveMutation.mutate(request.id)} isLoading={approveMutation.isPending}>
                        Approve Swap
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ShiftSwaps;
