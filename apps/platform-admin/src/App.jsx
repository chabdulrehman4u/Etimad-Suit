import React, { useState, useEffect } from 'react';
import { formatPKR } from '@etimad/ui';

export const App = () => {
  const [token, setToken] = useState(() => localStorage.getItem('etimad_superadmin_token') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Admin Dashboard State
  const [metrics, setMetrics] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [plans, setPlans] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  const adminFetch = async (url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Login failed');
      if (!json.data.user?.isPlatformAdmin) throw new Error('Account does not have Platform Super Admin privileges');

      setToken(json.data.token);
      localStorage.setItem('etimad_superadmin_token', json.data.token);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('etimad_superadmin_token');
  };

  const fetchDashboardData = async () => {
    if (!token) return;
    try {
      const [metricsRes, tenantsRes, plansRes] = await Promise.all([
        adminFetch('/api/v1/platform-admin/metrics'),
        adminFetch(`/api/v1/platform-admin/tenants?search=${encodeURIComponent(searchTerm)}`),
        adminFetch('/api/v1/platform-admin/plans'),
      ]);

      const metricsJson = await metricsRes.json();
      const tenantsJson = await tenantsRes.json();
      const plansJson = await plansRes.json();

      if (metricsJson.success) setMetrics(metricsJson.data);
      if (tenantsJson.success) setTenants(tenantsJson.data || []);
      if (plansJson.success) setPlans(plansJson.data || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token, searchTerm]);

  // Suspend / Reactivate Tenant
  const handleToggleTenantStatus = async (tenantId, currentStatus) => {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    try {
      const res = await adminFetch(`/api/v1/platform-admin/tenants/${tenantId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: newStatus,
          reason: newStatus === 'suspended' ? 'Administrative policy enforcement' : 'Account reactivated',
        }),
      });

      const json = await res.json();
      if (json.success) {
        setActionMessage(`Tenant status updated to ${newStatus}.`);
        fetchDashboardData();
        if (selectedTenant && selectedTenant.tenant._id === tenantId) {
          setSelectedTenant(null);
        }
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Inspect Tenant Details
  const handleInspectTenant = async (tenantId) => {
    try {
      const res = await adminFetch(`/api/v1/platform-admin/tenants/${tenantId}`);
      const json = await res.json();
      if (json.success) {
        setSelectedTenant(json.data);
      }
    } catch (err) {
      console.error('Failed to load tenant details:', err);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-black text-xl mx-auto shadow-lg mb-3">
              🛡️
            </div>
            <h2 className="text-xl font-extrabold text-white">Platform Administration</h2>
            <p className="text-xs text-slate-400 mt-1">Authorized Super-Admin Gateway</p>
          </div>

          {authError && (
            <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-xl text-rose-300 text-xs font-semibold mb-4">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Super-Admin Email</label>
              <input
                type="email"
                required
                placeholder="admin@etimadsuit.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Secure Password</label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Enter Admin Console'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Navigation */}
      <header className="h-16 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/60 backdrop-blur">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center font-bold text-sm shadow">
            ES
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight">Etimad Suit SaaS Platform Master Console</h1>
            <p className="text-[10px] text-slate-400 font-mono">Cluster: Production Multi-Tenant Authority</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
        >
          Sign Out
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI Metrics Strip */}
        {metrics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs text-slate-400 font-semibold">Total Subscribing Merchants</span>
              <p className="text-3xl font-black text-white mt-1">{metrics.tenants?.total || 0}</p>
              <div className="flex space-x-2 mt-2 text-[11px]">
                <span className="text-emerald-400 font-bold">{metrics.tenants?.active || 0} Active</span>
                <span className="text-slate-500">•</span>
                <span className="text-rose-400 font-bold">{metrics.tenants?.suspended || 0} Suspended</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs text-slate-400 font-semibold">Platform GMV (Gross Volume)</span>
              <p className="text-2xl font-black text-emerald-400 mt-1">{formatPKR(metrics.orders?.platformGmv || 0)}</p>
              <p className="text-[11px] text-slate-500 mt-2">{metrics.orders?.total || 0} Total Orders Processed</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs text-slate-400 font-semibold">Monthly Recurring Revenue (MRR)</span>
              <p className="text-2xl font-black text-sky-400 mt-1">{formatPKR(metrics.subscriptions?.monthlyRecurringRevenue || 0)}</p>
              <p className="text-[11px] text-slate-500 mt-2">{metrics.subscriptions?.activeSubscribers || 0} Paying Tenants</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-xs text-slate-400 font-semibold">Platform Users</span>
              <p className="text-3xl font-black text-indigo-400 mt-1">{metrics.users?.total || 0}</p>
              <p className="text-[11px] text-slate-500 mt-2">Owners, managers & cashiers</p>
            </div>
          </div>
        )}

        {actionMessage && (
          <div className="p-3 bg-sky-950/60 border border-sky-800 rounded-xl text-sky-300 text-xs font-semibold flex justify-between items-center">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">×</button>
          </div>
        )}

        {/* Merchants Directory */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-white">Registered Merchant Tenants</h3>
            <input
              type="text"
              placeholder="Search by store name, slug, or subdomain..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500 w-72"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Store Name</th>
                  <th className="p-3">Subdomain / Domain</th>
                  <th className="p-3">Plan</th>
                  <th className="p-3">Owner Contact</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Governance Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {tenants.map((t) => (
                  <tr key={t._id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-bold text-white">
                      {t.name}
                      <span className="block text-[10px] text-slate-500 font-mono">{t.slug}</span>
                    </td>
                    <td className="p-3 font-mono text-sky-400">
                      {t.subdomain}.etimadsuit.com
                      {t.customDomains?.[0] && (
                        <span className="block text-[10px] text-slate-400 font-sans">
                          {t.customDomains[0].domain} ({t.customDomains[0].isVerified ? '✓ Verified' : 'Unverified'})
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-semibold text-slate-300">{t.planId?.name || 'Default Tier'}</td>
                    <td className="p-3 text-slate-400">
                      <p className="text-slate-200">{t.ownerId?.name}</p>
                      <p className="text-[10px]">{t.ownerId?.email}</p>
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          t.status === 'active'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="p-3 text-center space-x-2">
                      <button
                        onClick={() => handleInspectTenant(t._id)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-bold border border-slate-700"
                      >
                        Inspect
                      </button>
                      <button
                        onClick={() => handleToggleTenantStatus(t._id, t.status)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold border ${
                          t.status === 'suspended'
                            ? 'bg-emerald-900/50 hover:bg-emerald-900 text-emerald-300 border-emerald-700'
                            : 'bg-rose-900/50 hover:bg-rose-900 text-rose-300 border-rose-700'
                        }`}
                      >
                        {t.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tenant Details Inspection Modal */}
      {selectedTenant && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white">{selectedTenant.tenant?.name}</h3>
                <p className="text-xs text-sky-400 font-mono">{selectedTenant.tenant?.slug}</p>
              </div>
              <button onClick={() => setSelectedTenant(null)} className="text-slate-400 hover:text-white">×</button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500">Catalog Products</span>
                <p className="text-lg font-bold text-white mt-0.5">{selectedTenant.usage?.products?.used || 0}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500">Active Staff</span>
                <p className="text-lg font-bold text-white mt-0.5">{selectedTenant.usage?.staff?.used || 0}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500">Lifetime Orders</span>
                <p className="text-lg font-bold text-white mt-0.5">{selectedTenant.financialOverview?.totalOrders || 0}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500">Store Lifetime GMV</span>
                <p className="text-sm font-bold text-emerald-400 mt-1">{formatPKR(selectedTenant.financialOverview?.lifetimeGmv || 0)}</p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedTenant(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

