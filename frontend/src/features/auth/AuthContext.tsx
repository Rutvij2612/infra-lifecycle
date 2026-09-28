import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiGet, apiPost, clearToken, getToken, setToken, UNAUTHORIZED_EVENT } from '../../lib/api';

export type UserRole = 'ADMIN' | 'GOVERNMENT_OFFICER' | 'FIELD_USER';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  department: { id: string; name: string } | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** UX only - the backend enforces every permission. */
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(() => getToken() !== null);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  // Restore the session from a stored token.
  useEffect(() => {
    if (!getToken()) return;
    apiGet<{ data: AuthUser }>('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  // Token expired / revoked while using the app -> back to login.
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiPost<{ data: { token: string; user: AuthUser } }>('/auth/login', { email, password });
    setToken(res.data.token);
    setUser(res.data.user);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout, hasRole: (...roles) => !!user && roles.includes(user.role) }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
