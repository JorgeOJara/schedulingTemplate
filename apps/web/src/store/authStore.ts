import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  orgId: string;
  orgName?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  finishBootstrap: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  isBootstrapping: true,
  login: (user) => {
    set({ user, isAuthenticated: true });
  },
  logout: () => {
    set({ user: null, isAuthenticated: false, isBootstrapping: false });
  },
  updateUser: (user) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...user } : null,
    }));
  },
  finishBootstrap: () => {
    set({ isBootstrapping: false });
  },
}));
