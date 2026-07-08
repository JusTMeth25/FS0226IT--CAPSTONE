import { apiClient, setToken } from './apiClient.js';

export const authApi = {
  async register(username, email, password) {
    const res = await apiClient.post('/auth/register', { username, email, password });
    if (res?.token) setToken(res.token);
    return res;
  },
  async login(email, password) {
    const res = await apiClient.post('/auth/login', { email, password });
    if (res?.token) setToken(res.token);
    return res;
  },
  async profile() {
    return apiClient.get('/auth/profile');
  },
  async updateAvatar(avatar) {
    return apiClient.patch('/auth/avatar', { avatar });
  },
  logout() {
    setToken(null);
  }
};
