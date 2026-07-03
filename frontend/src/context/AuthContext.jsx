import { useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '../services/authApi.js';
import { getToken, setToken } from '../services/apiClient.js';
import { AuthContext } from './auth-context.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const res = await authApi.profile();
        if (!cancelled) setUser(res?.user || null);
      } catch {
        setToken(null);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    bootstrap();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      const res = await authApi.login(email, password);
      setUser(res.user);
      return { ok: true };
    } catch (err) {
      setError(err.message);
      return { ok: false, error: err.message };
    }
  }, []);

  const register = useCallback(async (username, email, password) => {
    setError(null);
    try {
      const res = await authApi.register(username, email, password);
      setUser(res.user);
      return { ok: true };
    } catch (err) {
      setError(err.message);
      return { ok: false, error: err.message };
    }
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
  }, []);

  /** Ri-legge il profilo dal server (gold/xp/level/lastLoginDate cambiano dopo azioni di gioco). */
  const refreshUser = useCallback(async () => {
    if (!getToken()) return null;
    try {
      const res = await authApi.profile();
      setUser(res?.user || null);
      return res?.user || null;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser
  }), [user, loading, error, login, register, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
