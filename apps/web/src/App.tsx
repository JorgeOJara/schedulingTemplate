import { useEffect } from 'react';
import { Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AuthLayout from './layout/AuthLayout';
import DashboardLayout from './layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import WeekScheduler from './pages/WeekScheduler';
import MySchedule from './pages/MySchedule';
import TimeOffRequests from './pages/TimeOffRequests';
import ShiftSwaps from './pages/ShiftSwaps';
import EmployeeList from './pages/EmployeeList';
import EmployeeDetail from './pages/EmployeeDetail';
import Settings from './pages/Settings';
import JoinRequest from './pages/JoinRequest';
import MyProfile from './pages/MyProfile';
import { useAuthStore } from './store/authStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
    },
  },
});

function App() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const isEmployee = user?.role === 'EMPLOYEE' || user?.role === 'employee';

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const tokens = localStorage.getItem('tokens');
    if (!tokens) {
      logout();
    }
  }, [isAuthenticated, logout]);

  return (
    <QueryClientProvider client={queryClient}>
      {!isAuthenticated ? (
        <AuthLayout />
      ) : (
        <Routes>
          <Route element={<DashboardLayout />}>
            {isEmployee ? (
              <>
                <Route path="*" element={<MySchedule />} />
                <Route path="/my-schedule" element={<MySchedule />} />
                <Route path="/time-off" element={<TimeOffRequests />} />
                <Route path="/shift-swaps" element={<ShiftSwaps />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<MyProfile />} />
              </>
            ) : (
              <>
                <Route path="/" element={<Dashboard />} />
                <Route path="/scheduler" element={<WeekScheduler />} />
                <Route path="/my-schedule" element={<MySchedule />} />
                <Route path="/requests" element={<JoinRequest />} />
                <Route path="/employees" element={<EmployeeList />} />
                <Route path="/employees/:id" element={<EmployeeDetail />} />
                <Route path="/time-off" element={<TimeOffRequests />} />
                <Route path="/shift-swaps" element={<ShiftSwaps />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<MyProfile />} />
                <Route path="*" element={<Dashboard />} />
              </>
            )}
          </Route>
        </Routes>
      )}
    </QueryClientProvider>
  );
}

export default App;
