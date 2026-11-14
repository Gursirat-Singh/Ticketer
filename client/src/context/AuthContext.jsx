import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthAPI } from '../services/endpoints.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    AuthAPI.me()
      .then((d) => active && setUser(d.user))
      .catch(() => active && setUser(null))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const login = useCallback(async (body) => {
    const { user: u } = await AuthAPI.login(body);
    setUser(u);
    return u;
  }, []);
  const register = useCallback(async (body) => {
    const { user: u } = await AuthAPI.register(body);
    setUser(u);
    return u;
  }, []);
  const logout = useCallback(async () => {
    try { await AuthAPI.logout(); } finally { setUser(null); }
  }, []);

  const value = useMemo(() => ({ user, setUser, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
