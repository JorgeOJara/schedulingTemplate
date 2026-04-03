import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { useAuthStore } from '../store/authStore';
import { queryKeys } from '../hooks/useQueryKeys';
import api from '../services/api';
import {
  getOrgSetup,
  saveOrgSetup,
  type BusinessHour,
} from '../services/setupService';

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayNamesFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface LocationOption {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  active: boolean;
}

const Settings = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canManageOrg = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [businessName, setBusinessName] = useState('');
  const [selectedHoursLocationId, setSelectedHoursLocationId] = useState<string>('');
  const [locationHoursById, setLocationHoursById] = useState<Record<string, BusinessHour[]>>({});
  const [newLocation, setNewLocation] = useState({ name: '', address: '', phone: '' });
  const [pendingDeleteLocation, setPendingDeleteLocation] = useState<LocationOption | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' }>({ message: '', type: 'success' });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: setup, isLoading } = useQuery({
    queryKey: queryKeys.setup.org(),
    queryFn: getOrgSetup,
    enabled: canManageOrg,
  });

  const { data: locations = [] } = useQuery({
    queryKey: queryKeys.locations.list(user?.orgId || 'unknown'),
    queryFn: async () => {
      const response = await api.get('/locations');
      return response.data as LocationOption[];
    },
    enabled: canManageOrg && Boolean(user?.orgId),
  });

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
  };

  const updateBusinessMutation = useMutation({
    mutationFn: async () => {
      if (!businessName.trim()) throw new Error('Business name is required');
      const response = await api.put('/org/me', { name: businessName.trim() });
      return response.data;
    },
    onSuccess: () => {
      showFeedback('Business profile saved.');
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.me() });
      queryClient.invalidateQueries({ queryKey: queryKeys.setup.org() });
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.businesses() });
    },
    onError: (error: any) => {
      showFeedback(error?.response?.data?.error || error?.message || 'Failed to save', 'error');
    },
  });

  const addLocationMutation = useMutation({
    mutationFn: async () => {
      if (!newLocation.name.trim()) throw new Error('Location name is required');
      const response = await api.post('/locations', {
        name: newLocation.name.trim(),
        address: newLocation.address.trim() || undefined,
        phone: newLocation.phone.trim() || undefined,
      });
      return response.data as LocationOption;
    },
    onSuccess: () => {
      showFeedback('Location added.');
      setNewLocation({ name: '', address: '', phone: '' });
      queryClient.invalidateQueries({ queryKey: queryKeys.locations.list(user?.orgId || 'unknown') });
      queryClient.invalidateQueries({ queryKey: queryKeys.setup.org() });
    },
    onError: (error: any) => {
      showFeedback(error?.response?.data?.error || error?.message || 'Failed to add location', 'error');
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (locationId: string) => {
      await api.delete(`/locations/${locationId}`);
    },
    onSuccess: () => {
      showFeedback('Location and all related shifts deleted.');
      queryClient.invalidateQueries({ queryKey: queryKeys.locations.list(user?.orgId || 'unknown') });
      queryClient.invalidateQueries({ queryKey: queryKeys.setup.org() });
    },
    onError: (error: any) => {
      showFeedback(error?.response?.data?.error || error?.message || 'Failed to delete location', 'error');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      return saveOrgSetup({
        timezone: setup?.timezone,
        clockInEarlyAllowanceMinutes: setup?.clockInEarlyAllowanceMinutes ?? 5,
        dailyOtcThreshold: setup?.dailyOtcThreshold,
        weeklyOtcThreshold: setup?.weeklyOtcThreshold,
        maxHoursPerWeek: setup?.maxHoursPerWeek,
        schedulingMode: setup?.schedulingMode,
        aiAutoScheduleEnabled: setup?.aiAutoScheduleEnabled ?? false,
        businessHours: locations.length > 0 ? locationHoursById[locations[0].id] : [],
        locationBusinessHours: locations.map((location) => ({
          locationId: location.id,
          hours: locationHoursById[location.id] ?? [],
        })),
        defaultShiftTemplates: setup?.defaultShiftTemplates ?? [],
      });
    },
    onSuccess: () => {
      showFeedback('Saved.');
      queryClient.invalidateQueries({ queryKey: queryKeys.setup.org() });
    },
    onError: (error: any) => {
      showFeedback(error?.response?.data?.error || 'Failed to save', 'error');
    },
  });

  // Auto-clear feedback
  useEffect(() => {
    if (!feedback.message) return;
    const t = setTimeout(() => setFeedback({ message: '', type: 'success' }), 3000);
    return () => clearTimeout(t);
  }, [feedback]);

  // Debounced save for hours changes
  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveMutation.mutate(), 1000);
  }, [saveMutation]);

  // Hydrate state from server
  useEffect(() => {
    if (!setup) return;
    setBusinessName(setup.name);

    const defaultHours = dayNames.map((_, dayOfWeek) => ({
      dayOfWeek,
      openTime: dayOfWeek === 0 || dayOfWeek === 6 ? null : '09:00',
      closeTime: dayOfWeek === 0 || dayOfWeek === 6 ? null : '17:00',
      isClosed: dayOfWeek === 0 || dayOfWeek === 6,
    }));

    const incomingByLocation = Object.fromEntries(
      (setup.locationBusinessHours ?? []).map((entry) => [entry.locationId, entry.hours])
    ) as Record<string, BusinessHour[]>;

    const hydratedByLocation = Object.fromEntries(
      locations.map((location) => [
        location.id,
        (incomingByLocation[location.id] ?? setup.businessHours ?? defaultHours).slice().sort((a, b) => a.dayOfWeek - b.dayOfWeek),
      ])
    ) as Record<string, BusinessHour[]>;

    setLocationHoursById(hydratedByLocation);
    if (!selectedHoursLocationId || !hydratedByLocation[selectedHoursLocationId]) {
      setSelectedHoursLocationId(locations[0]?.id ?? '');
    }
  }, [setup, locations]);

  // Sync selected location IDs when locations change
  useEffect(() => {
    if (locations.length === 0) {
      setSelectedHoursLocationId('');
      return;
    }
    if (!selectedHoursLocationId || !locations.some((l) => l.id === selectedHoursLocationId)) {
      setSelectedHoursLocationId(locations[0].id);
    }
  }, [locations, selectedHoursLocationId]);

  if (!canManageOrg) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardContent>
            <p className="text-sm text-slate-600 py-4">
              Only managers and admins can edit organization settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
            <p className="text-sm text-slate-500 mt-1">
              Configure your business, locations, and hours. Build schedules directly in the scheduler.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/scheduler')}>
              Go to Scheduler
            </Button>
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Back
            </Button>
          </div>
        </div>

        {/* Feedback toast */}
        {feedback.message && (
          <div
            className={`rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2 transition-all ${
              feedback.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            <span className="text-base">{feedback.type === 'error' ? '\u2716' : '\u2714'}</span>
            {feedback.message}
          </div>
        )}

        {/* ── Business Profile ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Business Profile</CardTitle>
              <p className="text-xs text-slate-500 mt-1">Your organization details</p>
            </div>
            <Button onClick={() => updateBusinessMutation.mutate()} isLoading={updateBusinessMutation.isPending} size="sm">
              Save
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Business Name</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Business name"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Timezone</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50 text-slate-500"
                value={setup?.timezone ?? ''}
                disabled
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Locations ── */}
        <Card>
          <CardHeader>
            <CardTitle>Locations</CardTitle>
            <p className="text-xs text-slate-500 mt-1">Add your business addresses. Shifts and hours are configured per location.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add location form */}
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-3 space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Name *</label>
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all"
                    value={newLocation.name}
                    onChange={(e) => setNewLocation((c) => ({ ...c, name: e.target.value }))}
                    placeholder="e.g. Main Office"
                  />
                </div>
                <div className="md:col-span-5 space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Address</label>
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all"
                    value={newLocation.address}
                    onChange={(e) => setNewLocation((c) => ({ ...c, address: e.target.value }))}
                    placeholder="123 Main St"
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Phone</label>
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all"
                    value={newLocation.phone}
                    onChange={(e) => setNewLocation((c) => ({ ...c, phone: e.target.value }))}
                    placeholder="(555) 000-0000"
                  />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button size="sm" onClick={() => addLocationMutation.mutate()} isLoading={addLocationMutation.isPending}>
                    + Add Location
                  </Button>
                </div>
              </div>
            </div>

            {/* Location list */}
            {locations.length === 0 ? (
              <div className="text-center py-6 text-sm text-slate-400">
                No locations yet. Add one above to get started.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {locations.map((location) => (
                  <div
                    key={location.id}
                    className="flex items-center justify-between py-3 px-1 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{location.name}</div>
                        <div className="text-xs text-slate-500">
                          {location.address || 'No address'}{location.phone ? ` \u00B7 ${location.phone}` : ''}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setPendingDeleteLocation(location)}
                      className="text-xs text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all px-2 py-1 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Business Hours ── */}
        <Card>
          <CardHeader>
            <CardTitle>Business Hours</CardTitle>
            <p className="text-xs text-slate-500 mt-1">Set open/close times per location. Changes auto-save.</p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-slate-400 py-4 text-center">Loading...</div>
            ) : locations.length === 0 ? (
              <div className="text-sm text-slate-400 py-4 text-center">Add a location first.</div>
            ) : (
              <div className="space-y-4">
                <div className="max-w-sm">
                  <Select
                    label="Location"
                    value={selectedHoursLocationId}
                    onChange={(e) => setSelectedHoursLocationId(e.target.value)}
                    options={locations.map((l) => ({
                      value: l.id,
                      label: l.address ? `${l.name} \u2013 ${l.address}` : l.name,
                    }))}
                  />
                </div>

                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  {(locationHoursById[selectedHoursLocationId] ?? []).map((hour, index) => (
                    <div
                      key={`hour-${hour.dayOfWeek}`}
                      className={`flex items-center gap-4 px-4 py-3 transition-all ${
                        index > 0 ? 'border-t border-slate-100' : ''
                      } ${hour.isClosed ? 'bg-slate-50/60' : 'bg-white'}`}
                    >
                      {/* Day name */}
                      <div className="w-28 shrink-0">
                        <span className="text-sm font-semibold text-slate-800">{dayNamesFull[hour.dayOfWeek]}</span>
                      </div>

                      {/* Toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          const open = hour.isClosed;
                          setLocationHoursById((c) => ({
                            ...c,
                            [selectedHoursLocationId]: (c[selectedHoursLocationId] ?? []).map((row, ri) =>
                              ri === index
                                ? { ...row, isClosed: !open, openTime: open ? (row.openTime ?? '09:00') : null, closeTime: open ? (row.closeTime ?? '17:00') : null }
                                : row
                            ),
                          }));
                          debouncedSave();
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          !hour.isClosed ? 'bg-teal-500' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                            !hour.isClosed ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>

                      {/* Hours or Closed label */}
                      {hour.isClosed ? (
                        <span className="text-sm text-slate-400 italic">Closed</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={hour.openTime ?? '09:00'}
                            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all bg-white"
                            onChange={(e) => {
                              const value = e.target.value;
                              setLocationHoursById((c) => ({
                                ...c,
                                [selectedHoursLocationId]: (c[selectedHoursLocationId] ?? []).map((row, ri) =>
                                  ri === index ? { ...row, openTime: value } : row
                                ),
                              }));
                              debouncedSave();
                            }}
                          />
                          <span className="text-slate-400 text-sm">\u2013</span>
                          <input
                            type="time"
                            value={hour.closeTime ?? '17:00'}
                            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all bg-white"
                            onChange={(e) => {
                              const value = e.target.value;
                              setLocationHoursById((c) => ({
                                ...c,
                                [selectedHoursLocationId]: (c[selectedHoursLocationId] ?? []).map((row, ri) =>
                                  ri === index ? { ...row, closeTime: value } : row
                                ),
                              }));
                              debouncedSave();
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Saving indicator */}
        {saveMutation.isPending && (
          <div className="fixed bottom-4 right-4 bg-slate-900 text-white text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-2 z-50">
            <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Saving...
          </div>
        )}
      </div>

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        isOpen={Boolean(pendingDeleteLocation)}
        onClose={() => setPendingDeleteLocation(null)}
        title="Delete Location"
        action={
          <>
            <Button variant="ghost" onClick={() => setPendingDeleteLocation(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!pendingDeleteLocation) return;
                deleteLocationMutation.mutate(pendingDeleteLocation.id, {
                  onSettled: () => setPendingDeleteLocation(null),
                });
              }}
              isLoading={deleteLocationMutation.isPending}
            >
              Delete Permanently
            </Button>
          </>
        }
      >
        {pendingDeleteLocation && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              Are you sure you want to permanently delete <span className="font-semibold">"{pendingDeleteLocation.name}"</span>?
            </p>
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 space-y-1">
              <p className="font-medium">This will permanently remove:</p>
              <ul className="list-disc list-inside text-xs space-y-0.5">
                <li>All scheduled shifts tied to this location</li>
                <li>Business hours for this location</li>
              </ul>
              <p className="text-xs font-medium mt-2">This action cannot be undone.</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Settings;
