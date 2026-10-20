import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/v1/auth/register-tenant' : '/api/v1/auth/login';
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

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || 'Authentication failed');
      }

      login(json.data);
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
            {isRegister ? 'Start Your Business' : 'Etimad Suit Portal'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">Authoritative Multi-Tenant Business Management</p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold mb-4">
            {error}
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
              placeholder="admin@mybrand.pk"
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
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50"
            >
              {loading ? 'Please wait...' : (isRegister ? 'Create Store Account' : 'Sign In to Dashboard')}
            </button>
          </div>
        </form>

        <div className="mt-5 text-center text-xs text-slate-500 border-t border-slate-100 pt-4">
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
      </div>
    </div>
  );
};

const DashboardContent = () => {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('pos');

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 font-sans">
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
