import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('etimad_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('etimad_token') || '');
  const [tenant, setTenant] = useState(() => {
    const saved = localStorage.getItem('etimad_tenant');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (authData) => {
    setUser(authData.user);
    setToken(authData.token);
    setTenant(authData.tenant);
    localStorage.setItem('etimad_user', JSON.stringify(authData.user));
    localStorage.setItem('etimad_token', authData.token);
    localStorage.setItem('etimad_tenant', JSON.stringify(authData.tenant));
  };

  const logout = () => {
    setUser(null);
    setToken('');
    setTenant(null);
    localStorage.removeItem('etimad_user');
    localStorage.removeItem('etimad_token');
    localStorage.removeItem('etimad_tenant');
  };

  const authFetch = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenant ? { 'x-tenant-id': tenant._id } : {}),
      ...options.headers,
    };

    return fetch(url, { ...options, headers });
  };

  return (
    <AuthContext.Provider value={{ user, token, tenant, login, logout, authFetch, isAuthenticated: Boolean(token) }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

