import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { queryKeys } from '../hooks/useQueryKeys';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';

interface TimeOffRequest {
  id: string;
  startDate: string;
  endDate: string;
  type: string;
  reason: string;
  status: string;
  employee: { firstName: string; lastName: string };
}

const fetchTimeOffRequests = async ({ queryKey }: any): Promise<TimeOffRequest[]> => {
  const [, orgId] = queryKey;
  const response = await api.get('/time-off', { params: { status: 'PENDING' } });
  return response.data;
};

export const TimeOffRequests = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: requests, isLoading } = useQuery({
    queryKey: queryKeys.timeOff.list('my-org'),
    queryFn: fetchTimeOffRequests,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes?: string }) => {
      await api.put(`/time-off/${requestId}/approve`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timeOff.list('my-org') });
    },
  });

  const denyMutation = useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes?: string }) => {
      await api.put(`/time-off/${requestId}/deny`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timeOff.list('my-org') });
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading requests...</div>;
  }

  const filteredRequests = requests?.filter(request => 
    statusFilter === 'all' || request.status === statusFilter
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Time-Off Requests</h2>
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
      </div>

      <div className="space-y-3 sm:space-y-4">
        {filteredRequests?.map((request) => (
          <Card key={request.id}>
            <CardHeader>
              <CardTitle className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                  <span className="text-base sm:text-lg font-medium">
                    {request.employee.firstName} {request.employee.lastName}
                  </span>
                  <span className={`ml-0 sm:ml-3 inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-xs font-medium ${
                    request.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    request.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {request.status}
                  </span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm">
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

              {request.status === 'PENDING' && (
                <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                  <Button variant="secondary" onClick={() => denyMutation.mutate({ requestId: request.id, notes: 'Not enough staff coverage' })}>
                    Deny
                  </Button>
                  <Button onClick={() => approveMutation.mutate({ requestId: request.id })}>
                    Approve
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TimeOffRequests;
