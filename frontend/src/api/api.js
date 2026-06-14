import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  login: (payload) => api.post('/api/auth/login', payload),
  register: (payload) => api.post('/api/auth/register', payload),
  me: () => api.get('/api/auth/me')
};

export const groupApi = {
  list: () => api.get('/api/groups'),
  create: (payload) => api.post('/api/groups', payload),
  details: (id) => api.get(`/api/groups/${id}`),
  addMember: (id, payload) => api.post(`/api/groups/${id}/members`, payload),
  updateMember: (id, userId, payload) => api.put(`/api/groups/${id}/members/${userId}`, payload),
  remove: (id) => api.delete(`/api/groups/${id}`)
};

export const usersApi = {
  search: (query) => api.get('/api/users/search', { params: { q: query } })
};

export const expenseApi = {
  list: (groupId) => api.get('/api/expenses', { params: { group_id: groupId } }),
  details: (id) => api.get(`/api/expenses/${id}`),
  create: (payload) => api.post('/api/expenses', payload),
  remove: (id) => api.delete(`/api/expenses/${id}`)
};

export const balanceApi = {
  get: (groupId) => api.get('/api/balances', { params: { group_id: groupId } })
};

export const settlementApi = {
  list: (groupId) => api.get('/api/settlements', { params: { group_id: groupId } }),
  create: (payload) => api.post('/api/settlements', payload)
};

export const importApi = {
  preview: (formData) => api.post('/api/import/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  confirm: (payload) => api.post('/api/import/confirm', payload),
  logs: (groupId) => api.get('/api/import/logs', { params: { group_id: groupId } }),
  report: (logId, format = 'txt') => api.get(`/api/import/report/${logId}${format === 'pdf' ? '/pdf' : ''}`, { responseType: 'blob' })
};

export default api;
