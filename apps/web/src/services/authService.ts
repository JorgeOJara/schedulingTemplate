import api from './api';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    orgId: string;
    orgName?: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface OwnerRegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  organizationName: string;
}

export interface EmployeeRegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  organizationName: string;
}

export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  const response = await api.post('/auth/login', credentials);
  localStorage.setItem('tokens', JSON.stringify(response.data.tokens));
  localStorage.setItem('refreshToken', response.data.tokens.refreshToken);
  return response.data;
};

export const register = async (data: any): Promise<AuthResponse> => {
  const response = await api.post('/auth/register', data);
  localStorage.setItem('tokens', JSON.stringify(response.data.tokens));
  localStorage.setItem('refreshToken', response.data.tokens.refreshToken);
  return response.data;
};

export const registerOwner = async (data: OwnerRegisterInput): Promise<AuthResponse> => {
  const response = await api.post('/auth/register-owner', data);
  localStorage.setItem('tokens', JSON.stringify(response.data.tokens));
  localStorage.setItem('refreshToken', response.data.tokens.refreshToken);
  return response.data;
};

export const registerEmployee = async (data: EmployeeRegisterInput): Promise<{ message: string }> => {
  const response = await api.post('/auth/register-employee', data);
  return response.data;
};

export const getPendingEmployees = async () => {
  const response = await api.get('/auth/pending-employees');
  return response.data;
};

export const reviewPendingEmployee = async (userId: string, decision: 'APPROVE' | 'REJECT') => {
  const response = await api.patch(`/auth/pending-employees/${userId}`, { decision });
  return response.data;
};

export const acceptInvite = async (token: string, password: string): Promise<AuthResponse> => {
  const response = await api.post('/auth/accept-invite', { token, password });
  localStorage.setItem('tokens', JSON.stringify(response.data.tokens));
  localStorage.setItem('refreshToken', response.data.tokens.refreshToken);
  return response.data;
};

export const forgotPassword = async (email: string): Promise<void> => {
  await api.post('/auth/forgot-password', { email });
};

export const resetPassword = async (token: string, password: string): Promise<void> => {
  await api.post('/auth/reset-password', { token, password });
};

export const logout = async (): Promise<void> => {
  await api.post('/auth/logout');
  localStorage.removeItem('tokens');
  localStorage.removeItem('refreshToken');
};
