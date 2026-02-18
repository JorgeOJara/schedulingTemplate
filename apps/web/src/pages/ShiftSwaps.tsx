import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { queryKeys } from '../hooks/useQueryKeys';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';

interface ShiftSwapRequest {
  id: string;
  requestor: { firstName: string; lastName: string };
  responder: { firstName: string; lastName: string };
  proposedShiftIds: string[];
  requestedShiftIds: string[];
  type: string;
  reason: string;
  status: string;
}

const fetchShiftSwapRequests = async ({ queryKey }: any): Promise<ShiftSwapRequest[]> => {
  const [, orgId] = queryKey;
  const response = await api.get('/shift-swaps', { params: { status: 'PENDING' } });
  return response.data;
};

export const ShiftSwaps = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: requests, isLoading } = useQuery({
    queryKey: queryKeys.shiftSwaps.list('my-org'),
    queryFn: fetchShiftSwapRequests,
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await api.put(`/shift-swaps/${requestId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shiftSwaps.list('my-org') });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async ({ requestId }: { requestId: string }) => {
      await api.put(`/shift-swaps/${requestId}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shiftSwaps.list('my-org') });
    },
  });

  const denyMutation = useMutation({
    mutationFn: async ({ requestId }: { requestId: string }) => {
      await api.put(`/shift-swaps/${requestId}/deny`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shiftSwaps.list('my-org') });
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading swap requests...</div>;
  }

  const filteredRequests = requests?.filter(request => 
    statusFilter === 'all' || request.status === statusFilter
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Shift Swap Requests</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select 
            options={[
              { value: 'all', label: 'All Requests' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'ACCEPTED', label: 'Accepted' },
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
                    {request.requestor.firstName} {request.requestor.lastName} wants to swap shifts
                  </span>
                  {request.status !== 'PENDING' && (
                    <span className={`ml-0 sm:ml-3 inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-xs font-medium ${
                      request.status === 'ACCEPTED' ? 'bg-blue-100 text-blue-800' :
                      request.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {request.status}
                    </span>
                  )}
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
                  <span className="block text-sm font-semibold text-blue-800 mb-2">Wants to give away:</span>
                  <ul className="text-sm text-slate-700 space-y-1">
                    {request.proposedShiftIds.map(shiftId => (
                      <li key={shiftId}>Shift {shiftId.slice(-6)}</li>
                    ))}
                  </ul>
                </div>
                
                <div className="p-2 sm:p-3 bg-green-50 rounded-lg">
                  <span className="block text-sm font-semibold text-green-800 mb-2">Wants to receive:</span>
                  <ul className="text-sm text-slate-700 space-y-1">
                    {request.requestedShiftIds.map(shiftId => (
                      <li key={shiftId}>Shift {shiftId.slice(-6)}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mt-4 sm:mt-6">
                {request.status === 'PENDING' && (
                  <>
                    <Button variant="secondary" onClick={() => denyMutation.mutate({ requestId: request.id })}>
                      Deny
                    </Button>
                    <div className="flex space-x-2">
                      <Button variant="secondary" onClick={() => acceptMutation.mutate({ requestId: request.id })}>
                        Accept
                      </Button>
                      <Button onClick={() => approveMutation.mutate(request.id)}>
                        Approve
                      </Button>
                    </div>
                  </>
                )}
                {request.status === 'ACCEPTED' && (
                  <Button onClick={() => approveMutation.mutate(request.id)}>
                    Approve for Swap
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ShiftSwaps;
