import React, { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useAuthStore } from '../store/authStore';
import { getMyOrganization } from '../services/organizationService';

const menuItemsOwner = [
  { label: 'Dashboard', icon: '📊', path: '/' },
  { label: 'Scheduler', icon: '📅', path: '/scheduler' },
  { label: 'My Schedule', icon: '🗓️', path: '/my-schedule' },
  { label: 'My Profile', icon: '🙍', path: '/profile' },
  { label: 'Requests', icon: '📝', path: '/requests' },
  { label: 'Employees', icon: '👥', path: '/employees' },
  { label: 'Settings', icon: '⚙️', path: '/settings' },
];

const menuItemsEmployee = [
  { label: 'My Schedule', icon: '🗓️', path: '/my-schedule' },
  { label: 'My Profile', icon: '🙍', path: '/profile' },
  { label: 'Time Off', icon: '🌴', path: '/time-off' },
  { label: 'Shift Swaps', icon: '🔄', path: '/shift-swaps' },
  { label: 'Settings', icon: '⚙️', path: '/settings' },
];

const getInitials = (name: string): string => {
  const normalized = name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[\s\-_]+/)
    .filter(Boolean);

  if (normalized.length === 0) {
    return 'NA';
  }

  if (normalized.length === 1) {
    return normalized[0].slice(0, 2).toUpperCase();
  }

  return normalized
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { user, updateUser } = useAuthStore();
  const isEmployee = user?.role === 'EMPLOYEE' || user?.role === 'employee';
  const orgDisplayName = user?.orgName?.trim() || 'HealthCare Schedules';

  useEffect(() => {
    if (!user || user.orgName?.trim()) {
      return;
    }

    let isMounted = true;
    getMyOrganization()
      .then((org) => {
        if (!isMounted || !org?.name) {
          return;
        }
        updateUser({ orgName: org.name });
      })
      .catch(() => {
        // Keep fallback label if org lookup fails.
      });

    return () => {
      isMounted = false;
    };
  }, [user, updateUser]);

  const menuItems = isEmployee ? menuItemsEmployee : menuItemsOwner;

  const getMenuItemClass = (path: string) => {
    const isActive = location.pathname === path;
    return `flex items-center px-4 py-3 text-sm font-medium rounded-2xl transition-all duration-200 ${
      isActive
        ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20'
        : 'text-slate-600 hover:bg-teal-50 hover:text-teal-700'
    }`;
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 z-20 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <div className={`fixed left-0 z-30 h-full w-72 bg-gradient-to-b from-white to-teal-50 border-r border-teal-100 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:w-auto`}>
        <div className="flex h-20 items-center px-6 border-b border-teal-100/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-lg shadow-teal-600/30">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="hidden sm:block text-xl font-bold bg-gradient-to-r from-teal-700 to-teal-500 bg-clip-text text-transparent truncate" title={orgDisplayName}>
                {orgDisplayName}
              </h1>
              <h1 className="sm:hidden text-lg font-bold bg-gradient-to-r from-teal-700 to-teal-500 bg-clip-text text-transparent truncate" title={orgDisplayName}>
                {getInitials(orgDisplayName)}
              </h1>
            </div>
          </div>
        </div>

        <nav className="mt-8 px-4 pb-4 space-y-1.5">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <a
                key={item.path}
                href={item.path}
                className={getMenuItemClass(item.path)}
              >
                <span className="mr-3 h-5 w-5 flex-shrink-0 text-current">{item.icon}</span>
                <span className="truncate flex-1 font-medium">{item.label}</span>
                {isActive && <span className="ml-auto h-2 w-2 rounded-full bg-white/50" />}
              </a>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full border-t border-teal-100/60 bg-teal-50/80 backdrop-blur">
          <div className="px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center text-white font-semibold shadow-lg shadow-teal-500/30">
                {getInitials(`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User'}
                </p>
                <p className="text-xs font-medium text-teal-600 truncate capitalize">{user?.role?.toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
