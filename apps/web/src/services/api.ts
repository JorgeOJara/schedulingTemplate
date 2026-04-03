import axios, { type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

interface SessionResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    orgId: string;
    orgName?: string;
  };
  accessToken: string;
}

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  skipAuthRefresh?: boolean;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

const shouldSkipRefresh = (url?: string): boolean => {
  if (!url) {
    return false;
  }

  return [
    '/auth/login',
    '/auth/register',
    '/auth/register-owner',
    '/auth/register-employee',
    '/auth/accept-invite',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/refresh',
  ].some((path) => url.includes(path));
};

const applySession = (session: SessionResponse): string => {
  accessToken = session.accessToken;
  useAuthStore.getState().login(session.user);
  return session.accessToken;
};

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const clearAccessToken = (): void => {
  accessToken = null;
};

export const refreshSession = async (): Promise<SessionResponse> => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<SessionResponse>(
        `${API_BASE_URL}/auth/refresh`,
        {},
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
      .then((response) => {
        applySession(response.data);
        return response.data.accessToken;
      })
      .catch((error) => {
        clearAccessToken();
        useAuthStore.getState().logout();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  await refreshPromise;

  return {
    user: useAuthStore.getState().user!,
    accessToken: accessToken!,
  };
};

api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = (error.config ?? {}) as RetryableRequestConfig;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.skipAuthRefresh &&
      !shouldSkipRefresh(originalRequest.url)
    ) {
      originalRequest._retry = true;

      try {
        await refreshSession();
        return api(originalRequest);
      } catch (err) {
        clearAccessToken();
        useAuthStore.getState().logout();
        window.location.assign('/login');
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);

export const initializeSession = async (): Promise<SessionResponse | null> => {
  try {
    return await refreshSession();
  } catch {
    clearAccessToken();
    return null;
  }
};

export const applyAuthSession = (session: SessionResponse): void => {
  applySession(session);
};

export default api;
