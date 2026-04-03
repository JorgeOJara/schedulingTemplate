import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { queryKeys } from '../hooks/useQueryKeys';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { useAuthStore } from '../store/authStore';

interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  active: boolean;
  isActive?: boolean;
}

interface Location {
  id: string;
  name: string;
  address?: string | null;
  active: boolean;
}

interface GroupMember {
  id: string;
  userId: string;
  user: Employee;
}

interface EmployeeGroup {
  id: string;
  name: string;
  orgId: string;
  locationId: string;
  location: { id: string; name: string; address?: string | null };
  _count: { members: number };
  members: GroupMember[];
}

const EmployeeList = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');

  // Group management
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<EmployeeGroup | null>(null);
  const [groupDraft, setGroupDraft] = useState({ name: '', locationId: '' });
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<EmployeeGroup | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' }>({ message: '', type: 'success' });

  // Drag state
  const [draggedEmployee, setDraggedEmployee] = useState<Employee | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const dragCounterRef = useRef<Record<string, number>>({});

  const { data: employees = [], isLoading } = useQuery({
    queryKey: queryKeys.organizations.employees('me'),
    queryFn: async () => {
      const response = await api.get('/org/me/employees');
      return response.data as Employee[];
    },
  });

  const { data: locations = [] } = useQuery({
    queryKey: queryKeys.locations.list(user?.orgId || 'unknown'),
    queryFn: async () => {
      const response = await api.get('/locations');
      return response.data as Location[];
    },
    enabled: Boolean(user?.orgId),
  });

  const { data: groups = [] } = useQuery({
    queryKey: queryKeys.employeeGroups.list(user?.orgId || 'unknown'),
    queryFn: async () => {
      const response = await api.get('/employee-groups');
      return response.data as EmployeeGroup[];
    },
    enabled: Boolean(user?.orgId),
  });

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: 'success' }), 3000);
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.employeeGroups.list(user?.orgId || 'unknown') });
  };

  const createGroupMutation = useMutation({
    mutationFn: async (data: { name: string; locationId: string }) => {
      const response = await api.post('/employee-groups', data);
      return response.data;
    },
    onSuccess: () => { showFeedback('Group created.'); invalidateAll(); setGroupModalOpen(false); },
    onError: (error: any) => { showFeedback(error?.response?.data?.error || 'Failed to create group', 'error'); },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; locationId: string }) => {
      const response = await api.put(`/employee-groups/${id}`, data);
      return response.data;
    },
    onSuccess: () => { showFeedback('Group updated.'); invalidateAll(); setGroupModalOpen(false); setEditingGroup(null); },
    onError: (error: any) => { showFeedback(error?.response?.data?.error || 'Failed to update group', 'error'); },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) => { await api.delete(`/employee-groups/${groupId}`); },
    onSuccess: () => { showFeedback('Group deleted.'); invalidateAll(); setDeleteGroupTarget(null); },
    onError: (error: any) => { showFeedback(error?.response?.data?.error || 'Failed to delete group', 'error'); setDeleteGroupTarget(null); },
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      const response = await api.post(`/employee-groups/${groupId}/members`, { userId });
      return response.data;
    },
    onSuccess: () => { invalidateAll(); },
    onError: (error: any) => { showFeedback(error?.response?.data?.error || 'Failed to move employee', 'error'); },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      await api.delete(`/employee-groups/${groupId}/members/${userId}`);
    },
    onSuccess: () => { invalidateAll(); },
    onError: (error: any) => { showFeedback(error?.response?.data?.error || 'Failed to remove', 'error'); },
  });

  // Build lookup: employeeId -> group
  const employeeGroupMap = new Map<string, EmployeeGroup>();
  for (const group of groups) {
    for (const member of group.members ?? []) {
      employeeGroupMap.set(member.user.id, group);
    }
  }

  const assignedEmployeeIds = new Set(employeeGroupMap.keys());
  const unassignedEmployees = employees.filter((emp) => emp.active && !assignedEmployeeIds.has(emp.id));

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── Drag handlers ──
  const handleDragStart = (e: React.DragEvent, emp: Employee) => {
    setDraggedEmployee(emp);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', emp.id);
    setTimeout(() => (e.currentTarget as HTMLElement).classList.add('opacity-40'), 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedEmployee(null);
    setDragOverTarget(null);
    dragCounterRef.current = {};
    (e.currentTarget as HTMLElement).classList.remove('opacity-40');
  };

  const handleDragEnter = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    dragCounterRef.current[targetId] = (dragCounterRef.current[targetId] || 0) + 1;
    setDragOverTarget(targetId);
  };

  const handleDragLeave = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    dragCounterRef.current[targetId] = (dragCounterRef.current[targetId] || 0) - 1;
    if (dragCounterRef.current[targetId] <= 0) {
      dragCounterRef.current[targetId] = 0;
      if (dragOverTarget === targetId) setDragOverTarget(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnGroup = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    setDragOverTarget(null);
    dragCounterRef.current = {};
    if (!draggedEmployee) return;
    addMemberMutation.mutate({ groupId, userId: draggedEmployee.id });
    setDraggedEmployee(null);
  };

  const handleDropOnUnassigned = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverTarget(null);
    dragCounterRef.current = {};
    if (!draggedEmployee) return;
    const currentGroup = employeeGroupMap.get(draggedEmployee.id);
    if (currentGroup) {
      removeMemberMutation.mutate({ groupId: currentGroup.id, userId: draggedEmployee.id });
    }
    setDraggedEmployee(null);
  };

  const openCreateGroupModal = () => {
    setEditingGroup(null);
    setGroupDraft({ name: '', locationId: locations[0]?.id ?? '' });
    setGroupModalOpen(true);
  };

  const openEditGroupModal = (group: EmployeeGroup) => {
    setEditingGroup(group);
    setGroupDraft({ name: group.name, locationId: group.locationId });
    setGroupModalOpen(true);
  };

  // Draggable employee chip
  const EmployeeChip = ({ emp, showRemove, groupId }: { emp: Employee; showRemove?: boolean; groupId?: string }) => (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, emp)}
      onDragEnd={handleDragEnd}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md hover:border-teal-300 transition-all select-none group/chip"
    >
      <div className="w-7 h-7 rounded-full bg-teal-100 border border-teal-200 flex items-center justify-center text-teal-700 font-bold text-[10px] shrink-0">
        {emp.firstName[0]}{emp.lastName[0]}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-800 truncate">{emp.firstName} {emp.lastName}</div>
        <div className="text-[10px] text-slate-400 capitalize">{emp.role.toLowerCase()}</div>
      </div>
      {showRemove && groupId && (
        <button
          onClick={(e) => { e.stopPropagation(); removeMemberMutation.mutate({ groupId, userId: emp.id }); }}
          className="ml-1 text-slate-300 hover:text-red-500 opacity-0 group-hover/chip:opacity-100 transition-all shrink-0"
          title="Remove from group"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30 flex items-center justify-center">
        <div className="text-sm text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Employees</h1>
            <p className="text-sm text-slate-500 mt-1">Manage your team and assign them to location groups.</p>
          </div>
        </div>

        {/* Feedback */}
        {feedback.message && (
          <div className={`rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2 ${
            feedback.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
            <span className="text-base">{feedback.type === 'error' ? '\u2716' : '\u2714'}</span>
            {feedback.message}
          </div>
        )}

        {/* ── Employee Table ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>All Employees</CardTitle>
              <p className="text-xs text-slate-500 mt-1">{employees.length} total</p>
            </div>
            <div className="max-w-xs w-full">
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Group</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map((emp) => {
                    const group = employeeGroupMap.get(emp.id);
                    return (
                      <tr key={emp.id} className="hover:bg-teal-50/30 transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-teal-100 border border-teal-200 flex items-center justify-center text-teal-700 font-bold text-xs shrink-0">
                              {emp.firstName[0]}{emp.lastName[0]}
                            </div>
                            <span className="font-medium text-slate-800">{emp.firstName} {emp.lastName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-slate-500 hidden sm:table-cell">{emp.email}</td>
                        <td className="px-6 py-3 text-slate-500 hidden sm:table-cell capitalize">{emp.role.toLowerCase()}</td>
                        <td className="px-6 py-3">
                          {group ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-700 border border-teal-200">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              </svg>
                              {group.name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-400">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            emp.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {emp.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredEmployees.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400">No employees found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Folder Tree — Drag & Drop ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Groups</CardTitle>
              <p className="text-xs text-slate-500 mt-1">Drag employees between folders. Each person can only be in one group.</p>
            </div>
            {locations.length > 0 && (
              <Button size="sm" onClick={openCreateGroupModal}>+ New Group</Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {locations.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400 px-6">
                Add locations in Settings before creating groups.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {/* Unassigned folder */}
                <div
                  className={`transition-all ${dragOverTarget === 'unassigned' ? 'bg-amber-50/60' : ''}`}
                  onDragEnter={(e) => handleDragEnter(e, 'unassigned')}
                  onDragLeave={(e) => handleDragLeave(e, 'unassigned')}
                  onDragOver={handleDragOver}
                  onDrop={handleDropOnUnassigned}
                >
                  <div className="px-5 py-3 flex items-center gap-3">
                    <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="text-sm font-semibold text-slate-700">Unassigned</span>
                    <span className="text-xs text-slate-400 ml-1">({unassignedEmployees.length})</span>
                  </div>
                  {unassignedEmployees.length > 0 && (
                    <div className="pl-12 pr-5 pb-3 flex flex-wrap gap-2">
                      {unassignedEmployees.map((emp) => <EmployeeChip key={emp.id} emp={emp} />)}
                    </div>
                  )}
                  {unassignedEmployees.length === 0 && (
                    <div className="pl-12 pr-5 pb-3 text-xs text-slate-400">
                      {dragOverTarget === 'unassigned' ? (
                        <span className="text-amber-600 font-medium">Drop here to unassign</span>
                      ) : employees.filter((e) => e.active).length === 0 ? 'No active employees' : 'All employees are assigned to groups'}
                    </div>
                  )}
                </div>

                {/* Group folders */}
                {groups.map((group) => {
                  const isOver = dragOverTarget === group.id;
                  return (
                    <div
                      key={group.id}
                      className={`transition-all ${isOver ? 'bg-teal-50/50' : ''}`}
                      onDragEnter={(e) => handleDragEnter(e, group.id)}
                      onDragLeave={(e) => handleDragLeave(e, group.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropOnGroup(e, group.id)}
                    >
                      <div className="px-5 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <svg className="w-5 h-5 text-teal-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                          <div>
                            <span className="text-sm font-semibold text-slate-800">{group.name}</span>
                            <span className="text-xs text-slate-400 ml-2">({group._count.members})</span>
                            <div className="text-[11px] text-slate-400">
                              {group.location.name}
                              {group.location.address && ` \u2013 ${group.location.address}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEditGroupModal(group)}
                            className="text-xs text-teal-600 hover:text-teal-800 px-2 py-1 rounded-md hover:bg-teal-50 font-medium transition-all"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteGroupTarget(group)}
                            className="text-xs text-slate-400 hover:text-red-600 px-2 py-1 rounded-md hover:bg-red-50 transition-all"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="pl-12 pr-5 pb-3 min-h-[32px] flex flex-wrap gap-2">
                        {(!group.members || group.members.length === 0) ? (
                          <div className="text-xs text-slate-400">
                            {isOver ? <span className="text-teal-600 font-medium">Drop here to add</span> : 'Empty \u2014 drag employees here'}
                          </div>
                        ) : (
                          <>
                            {group.members.map((member) => (
                              <EmployeeChip key={member.id} emp={member.user} showRemove groupId={group.id} />
                            ))}
                            {isOver && (
                              <div className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border-2 border-dashed border-teal-300 bg-teal-50/50 text-xs text-teal-600 font-medium">
                                + Drop
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {groups.length === 0 && (
                  <div className="px-5 py-6 text-center text-sm text-slate-400">
                    No groups yet. Click "+ New Group" to create one.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Create/Edit Group Modal ── */}
      <Modal
        isOpen={groupModalOpen}
        onClose={() => { setGroupModalOpen(false); setEditingGroup(null); }}
        title={editingGroup ? 'Edit Group' : 'New Group'}
        action={
          <>
            <Button variant="ghost" onClick={() => { setGroupModalOpen(false); setEditingGroup(null); }}>Cancel</Button>
            <Button
              isLoading={createGroupMutation.isPending || updateGroupMutation.isPending}
              onClick={() => {
                if (!groupDraft.name.trim() || !groupDraft.locationId) return;
                if (editingGroup) {
                  updateGroupMutation.mutate({ id: editingGroup.id, name: groupDraft.name.trim(), locationId: groupDraft.locationId });
                } else {
                  createGroupMutation.mutate({ name: groupDraft.name.trim(), locationId: groupDraft.locationId });
                }
              }}
            >
              {editingGroup ? 'Save' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Group Name</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all"
              value={groupDraft.name}
              onChange={(e) => setGroupDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Nurses Team A"
            />
          </div>
          <Select
            label="Location"
            value={groupDraft.locationId}
            onChange={(e) => setGroupDraft((d) => ({ ...d, locationId: e.target.value }))}
            options={locations.map((l) => ({
              value: l.id,
              label: l.address ? `${l.name} \u2013 ${l.address}` : l.name,
            }))}
          />
        </div>
      </Modal>

      {/* ── Delete Group Confirmation ── */}
      <Modal
        isOpen={Boolean(deleteGroupTarget)}
        onClose={() => setDeleteGroupTarget(null)}
        title="Delete Group"
        action={
          <>
            <Button variant="ghost" onClick={() => setDeleteGroupTarget(null)}>Cancel</Button>
            <Button variant="danger" isLoading={deleteGroupMutation.isPending} onClick={() => { if (deleteGroupTarget) deleteGroupMutation.mutate(deleteGroupTarget.id); }}>
              Delete
            </Button>
          </>
        }
      >
        {deleteGroupTarget && (
          <div className="space-y-2">
            <p className="text-sm text-slate-700">Delete <span className="font-semibold">"{deleteGroupTarget.name}"</span>?</p>
            <p className="text-xs text-slate-500">Members will become unassigned. No employees are deleted.</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default EmployeeList;
