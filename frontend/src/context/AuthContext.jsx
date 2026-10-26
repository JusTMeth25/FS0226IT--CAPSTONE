import { useCallback, useEffect, useMemo, useState } from 'react';
import { authApi, authErrorText } from '../services/authApi.js';
import { hasSession, setToken } from '../services/apiClient.js';
import { AuthContext } from './auth-context.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      if (!hasSession()) {
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

  /**
   * Esito comune degli accessi: { ok: true } col profilo caricato, oppure { ok: false, twoFactor }
   * quando serve il codice a 6 cifre, oppure { ok: false, error } col messaggio da mostrare.
   */
  const finish = useCallback(async (call) => {
    setError(null);
    try {
      const res = await call();
      if (!res) return { ok: false, cancelled: true };
      if (res.twoFactorRequired) return { ok: false, twoFactor: res.challenge };
      setUser(res.user);
      return { ok: true };
    } catch (err) {
      const text = authErrorText(err, err.message);
      setError(text);
      return { ok: false, error: text, code: err.code };
    }
  }, []);

  const login = useCallback((email, password) => finish(() => authApi.login(email, password)), [finish]);
  const register = useCallback((username, email, password) => finish(() => authApi.register(username, email, password)), [finish]);
  /** {@code signIn} apre l'accesso con Google e restituisce { idToken, name }, oppure null se annullato. */
  const socialLogin = useCallback((provider, signIn) => finish(async () => {
    const got = await signIn();
    return got ? authApi.social(provider, got.idToken, got.name) : null;
  }), [finish]);
  const verifyTwoFactor = useCallback((challenge, code, remember) =>
    finish(() => authApi.verifyTwoFactor(challenge, code, remember)), [finish]);

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
  }, []);

  /** Ri-legge il profilo dal server (gold/xp/level/lastLoginDate cambiano dopo azioni di gioco). */
  const refreshUser = useCallback(async () => {
    if (!hasSession()) return null;
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
    socialLogin,
    verifyTwoFactor,
    logout,
    refreshUser
  }), [user, loading, error, login, register, socialLogin, verifyTwoFactor, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
