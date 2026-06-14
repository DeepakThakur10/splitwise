import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    authApi.me()
      .then((response) => setUser(response.data))
      .catch(() => {
        localStorage.removeItem('token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const persistSession = (token, nextUser) => {
    localStorage.setItem('token', token);
    setUser(nextUser);
  };

  const login = async (credentials) => {
    const { data } = await authApi.login(credentials);
    persistSession(data.token, data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await authApi.register(payload);
    persistSession(data.token, data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}