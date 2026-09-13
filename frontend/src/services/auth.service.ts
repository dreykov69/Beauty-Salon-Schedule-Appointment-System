import { api } from './api';

export const authService = {
  login: async (credentials: any) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },
  
  register: async (userData: any) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  forgotPassword: async (email: string) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (data: { token: string; newPassword: string; confirmPassword: string }) => {
    const response = await api.post('/auth/reset-password', data);
    return response.data;
  }
};
