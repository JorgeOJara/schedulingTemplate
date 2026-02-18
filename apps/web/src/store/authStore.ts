import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  orgId?: string;
  orgName?: string;
}

interface AuthState {
  user: User | null;
  tokens: {
    accessToken: string;
    refreshToken: string;
  } | null;
  isAuthenticated: boolean;
  login: (user: User, tokens: AuthState['tokens']) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      login: (user, tokens) => {
        set({ user, tokens, isAuthenticated: true });
      },
      logout: () => {
        set({ user: null, tokens: null, isAuthenticated: false });
      },
      updateUser: (user) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...user } : null,
        }));
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
