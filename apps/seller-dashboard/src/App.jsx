import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { getApiBaseUrl } from '@etimad/ui';
import { Sidebar } from './components/Sidebar';
import { PosTerminal } from './components/PosTerminal';
import { OrdersManager } from './components/OrdersManager';
import { ProductsManager } from './components/ProductsManager';
import { ThemeCustomizer } from './components/ThemeCustomizer';
import { FinanceOverview } from './components/FinanceOverview';
import { AppsManager } from './components/AppsManager';
import { BillingManager } from './components/BillingManager';

const AuthScreen = () => {
  const { login } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    tenantName: '',
    ownerName: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Explicit Sandbox Mode (Strictly separated from real authentication)
  const handleLaunchSandbox = () => {
    login(
      {
        token: 'demo_sandbox_token_etimad_simulated_session',
        user: {
          _id: 'usr-sandbox-001',
          name: 'Demo Merchant (Sandbox)',
          email: 'demo@sandbox.local',
          role: 'TENANT_ADMIN',
        },
        tenant: {
          _id: 'ten-sandbox-001',
          name: 'Demo Store Sandbox',
          slug: 'demo-sandbox',
          currency: 'PKR',
          plan: 'GROWTH_TIER',
        },
      },
      true // Explicit demoMode flag
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const apiBase = getApiBaseUrl();
      const endpoint = isRegister
        ? `${apiBase}/api/v1/auth/register-tenant`
        : `${apiBase}/api/v1/auth/login`;

      const body = isRegister
        ? {
            tenantName: formData.tenantName,
            ownerName: formData.ownerName,
            email: formData.email,
            password: formData.password,
            phone: formData.phone,
          }
        : {
            email: formData.email,
            password: formData.password,
          };

      let res;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (networkErr) {
        throw new Error(
          `Unable to reach the Etimad Suit backend API at ${apiBase || 'current host'}. Please verify the backend server is running and accessible.`
        );
      }

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        throw new Error(
          json?.error?.message ||
            `Authentication failed with status ${res.status}. Please check your credentials.`
        );
      }

      // Genuine backend authentication succeeded
      login(json.data, false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 border border-slate-800">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-sky-500 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl mx-auto shadow-lg mb-3">
            ES
          </div>
          <h2 className="text-2xl font-black text-slate-900">
            {isRegister ? 'Register New Merchant' : 'Etimad Suit Portal'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">Authoritative Multi-Tenant Business Management</p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold mb-4 space-y-1">
            <p className="font-bold flex items-center space-x-1">
              <span>⚠️</span>
              <span>Connection / Auth Error</span>
            </p>
            <p className="font-normal text-[11px] leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {isRegister && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Business / Store Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Al-Rehman Electronics"
                  value={formData.tenantName}
                  onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Owner Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Abdul Rehman"
                  value={formData.ownerName}
                  onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Phone</label>
                <input
                  type="tel"
                  placeholder="03001234567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
            <input
              type="email"
              required
              placeholder="owner@mybrand.pk"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password *</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50"
            >
              {loading ? 'Verifying with Authoritative Backend...' : (isRegister ? 'Register Merchant Account' : 'Sign In with Authoritative Backend')}
            </button>
          </div>
        </form>

        <div className="mt-4 text-center text-xs text-slate-500 border-t border-slate-100 pt-3">
          {isRegister ? (
            <p>
              Already registered?{' '}
              <button onClick={() => setIsRegister(false)} className="text-sky-600 font-bold hover:underline">
                Sign In
              </button>
            </p>
          ) : (
            <p>
              New merchant?{' '}
              <button onClick={() => setIsRegister(true)} className="text-sky-600 font-bold hover:underline">
                Register New Business
              </button>
            </p>
          )}
        </div>

        {/* Clearly Separated Offline Sandbox Option */}
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-center">
          <p className="text-[11px] text-amber-800 font-semibold mb-1.5">
            Testing without a live database?
          </p>
          <button
            type="button"
            onClick={handleLaunchSandbox}
            className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center space-x-1"
          >
            <span>⚡ Explore Offline Demo Sandbox</span>
          </button>
          <p className="text-[10px] text-amber-700/80 mt-1">
            Clearly labeled simulation. Will not affect production data.
          </p>
        </div>
      </div>
    </div>
  );
};

const DashboardContent = () => {
  const { isAuthenticated, isDemo } = useAuth();
  const [activeTab, setActiveTab] = useState('pos');

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 font-sans flex-col">
      {/* Explicit Sandbox Notification Banner */}
      {isDemo && (
        <div className="bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-bold flex items-center justify-between shadow-sm z-50">
          <div className="flex items-center space-x-2">
            <span>⚠️</span>
            <span>
              <strong>OFFLINE DEMO SANDBOX MODE:</strong> You are viewing an offline simulation. Changes are stored locally and will NOT sync to the live database.
            </span>
          </div>
          <span className="text-[10px] bg-slate-950/20 px-2 py-0.5 rounded uppercase tracking-wider font-mono">
            Sandbox Environment
          </span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'pos' && <PosTerminal />}
          {activeTab === 'orders' && <OrdersManager />}
          {activeTab === 'products' && <ProductsManager />}
          {activeTab === 'theme' && <ThemeCustomizer />}
          {activeTab === 'finance' && <FinanceOverview />}
          {activeTab === 'apps' && <AppsManager />}
          {activeTab === 'billing' && <BillingManager />}
        </main>
      </div>
    </div>
  );
};

export const App = () => {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
};

export default App;
