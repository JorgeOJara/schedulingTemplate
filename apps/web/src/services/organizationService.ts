import api from './api';

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
}

export const getMyOrganization = async (): Promise<Organization> => {
  const response = await api.get('/org/me');
  return response.data;
};
