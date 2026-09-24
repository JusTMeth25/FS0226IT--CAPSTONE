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
  /** Aspetto dell'avatar nell'hotel, dal guardaroba (es. "s1.h1.hc0.sh0.p0"). */
  async updateLook(look) {
    return apiClient.patch('/auth/look', { look });
  },
  logout() {
    setToken(null);
  }
};
