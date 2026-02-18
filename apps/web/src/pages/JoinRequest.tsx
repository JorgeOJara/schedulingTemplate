import { useState } from 'react';
import { Check, Search, Users, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPendingEmployees, reviewPendingEmployee } from '../services/authService';

interface PendingEmployee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

const JoinRequest = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: requests = [], isLoading, error } = useQuery<PendingEmployee[]>({
    queryKey: ['pending-employees'],
    queryFn: getPendingEmployees,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ userId, decision }: { userId: string; decision: 'APPROVE' | 'REJECT' }) =>
      reviewPendingEmployee(userId, decision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-employees'] });
    },
  });

  const filteredRequests = requests.filter((req) => {
    const fullName = `${req.firstName} ${req.lastName}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) || req.email.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Join Organization Requests</h2>
        <p className="text-sm text-slate-600">Approve employees before they can access schedules.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm text-slate-600">Pending requests: {requests.length}</div>
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
        ) : filteredRequests.length === 0 ? (
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
              {filteredRequests.map((request) => (
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
    </div>
  );
};

export default JoinRequest;
