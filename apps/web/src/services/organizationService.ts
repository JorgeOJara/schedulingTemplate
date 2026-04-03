import api from './api';

export interface Organization {
  id: string;
  name: string;
  timezone?: string;
  createdAt: string;
}

export const getMyOrganization = async (): Promise<Organization> => {
  const response = await api.get('/org/me');
  return response.data;
};

export const getAccessibleBusinesses = async (): Promise<Organization[]> => {
  const response = await api.get('/org/businesses');
  return response.data;
};
