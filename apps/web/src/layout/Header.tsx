import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationModal } from '../components/NotificationModal';
import { useNotifications } from '../hooks/useNotifications';
import { logout as logoutApi } from '../services/authService';
import { useAuthStore } from '../store/authStore';

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const { user, logout: logoutStore } = useAuthStore();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { unreadCount } = useNotifications();

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    try {
      await logoutApi();
    } catch (error) {
      console.error('Logout request failed, continuing with local logout.', error);
    } finally {
      localStorage.removeItem('tokens');
      localStorage.removeItem('refreshToken');
      logoutStore();
      setIsLoggingOut(false);
      navigate('/login', { replace: true });
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex items-center">
        <button 
          onClick={onMenuClick}
          className="mr-3 sm:mr-4 flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        >
          <svg className="h-6 w-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-4 overflow-x-auto">
        <div className="relative">
          <button
            onClick={() => setIsNotificationOpen(true)}
            className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-full"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
        <div className="relative">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center space-x-2 text-slate-600 hover:bg-slate-100 rounded-lg p-2"
          >
            <span className="text-sm font-medium">
              {isLoggingOut ? 'Logging out...' : `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Logout'}
            </span>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
            </svg>
          </button>
        </div>
      </div>

      <NotificationModal
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
      />
    </header>
  );
};

export default Header;
