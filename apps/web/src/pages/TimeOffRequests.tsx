import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { useAuthStore } from '../store/authStore';

interface TimeOffRequest {
  id: string;
  startDate: string;
  endDate: string;
  type: string;
  reason: string;
  status: string;
  employee: { firstName: string; lastName: string };
}

const fetchTimeOffRequests = async (statusFilter: string): Promise<TimeOffRequest[]> => {
  const response = await api.get('/time-off', {
    params: statusFilter === 'all' ? undefined : { status: statusFilter },
  });
  return response.data;
};

const fetchMyTimeOffRequests = async (): Promise<TimeOffRequest[]> => {
  const response = await api.get('/time-off/my-requests');
  return response.data;
};

export const TimeOffRequests = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const { user } = useAuthStore();
  const isManager = ['ADMIN', 'MANAGER'].includes(user?.role ?? '');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['time-off', isManager ? 'org' : 'mine', statusFilter],
    queryFn: () => (isManager ? fetchTimeOffRequests(statusFilter) : fetchMyTimeOffRequests()),
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await api.put(`/time-off/${requestId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-off', 'org'] });
    },
  });

  const denyMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await api.put(`/time-off/${requestId}/deny`, { notes: 'Denied by manager review' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-off', 'org'] });
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading requests...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          {isManager ? 'Time-Off Requests' : 'My Time-Off Requests'}
        </h2>
        {isManager && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select
              options={[
                { value: 'all', label: 'All Requests' },
                { value: 'PENDING', label: 'Pending' },
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
            <CardContent className="py-6 text-sm text-slate-500">No requests found.</CardContent>
          </Card>
        ) : (
          requests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <CardTitle className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <div>
                    {isManager && (
                      <span className="text-base sm:text-lg font-medium mr-2">
                        {request.employee?.firstName} {request.employee?.lastName}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        request.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-800'
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                  <div>
                    <span className="block text-slate-500">Period</span>
                    <div className="font-medium">
                      {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <span className="block text-slate-500">Type</span>
                    <div className="font-medium capitalize">{request.type.toLowerCase()}</div>
                  </div>
                </div>

                <div className="mt-3 sm:mt-4">
                  <span className="block text-sm font-medium text-slate-700">Reason</span>
                  <p className="mt-1 text-sm text-slate-600">{request.reason}</p>
                </div>

                {isManager && request.status === 'PENDING' && (
                  <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                    <Button
                      variant="secondary"
                      onClick={() => denyMutation.mutate(request.id)}
                      isLoading={denyMutation.isPending}
                    >
                      Deny
                    </Button>
                    <Button onClick={() => approveMutation.mutate(request.id)} isLoading={approveMutation.isPending}>
                      Approve
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default TimeOffRequests;
