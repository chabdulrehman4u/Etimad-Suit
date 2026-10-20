import React, { createContext, useContext, useState, useEffect } from 'react';
import { getApiBaseUrl } from '@etimad/ui';

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
  const [isDemo, setIsDemo] = useState(() => {
    return localStorage.getItem('etimad_is_demo') === 'true';
  });

  const login = (authData, demoMode = false) => {
    const isSandbox = demoMode || authData.token?.startsWith('demo_sandbox_');
    setUser(authData.user);
    setToken(authData.token);
    setTenant(authData.tenant);
    setIsDemo(isSandbox);
    localStorage.setItem('etimad_user', JSON.stringify(authData.user));
    localStorage.setItem('etimad_token', authData.token);
    localStorage.setItem('etimad_tenant', JSON.stringify(authData.tenant));
    localStorage.setItem('etimad_is_demo', String(isSandbox));
  };

  const logout = () => {
    setUser(null);
    setToken('');
    setTenant(null);
    setIsDemo(false);
    localStorage.removeItem('etimad_user');
    localStorage.removeItem('etimad_token');
    localStorage.removeItem('etimad_tenant');
    localStorage.removeItem('etimad_is_demo');
  };

  const authFetch = async (url, options = {}) => {
    const apiBase = getApiBaseUrl();
    const fullUrl = url.startsWith('http') ? url : `${apiBase}${url}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenant ? { 'x-tenant-id': tenant._id } : {}),
      ...options.headers,
    };

    return fetch(fullUrl, { ...options, headers });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        tenant,
        isDemo,
        login,
        logout,
        authFetch,
        isAuthenticated: Boolean(token),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
