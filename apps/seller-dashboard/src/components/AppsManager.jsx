import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export const AppsManager = () => {
  const { authFetch } = useAuth();
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [credentials, setCredentials] = useState({ apiKey: '', apiPassword: '', accountCode: '' });
  const [testMode, setTestMode] = useState(true);
  const [message, setMessage] = useState(null);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/v1/apps/connections');
      const json = await res.json();
      if (json.success) {
        setConnections(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load apps:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleSaveConnection = async (e) => {
    e.preventDefault();
    if (!selectedProvider) return;

    try {
      const res = await authFetch('/api/v1/apps/connections', {
        method: 'POST',
        body: JSON.stringify({
          providerId: selectedProvider,
          credentials,
          testMode,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: `Successfully connected ${selectedProvider.toUpperCase()}!` });
        setSelectedProvider(null);
        setCredentials({ apiKey: '', apiPassword: '', accountCode: '' });
        fetchConnections();
      } else {
        setMessage({ type: 'error', text: json.error?.message });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden bg-slate-100">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">Apps & Logistics Integrations</h2>
          <p className="text-xs text-slate-500">Connect third-party couriers with AES-256 encrypted credential protection</p>
        </div>
      </div>

      {message && (
        <div
          className={`mt-3 p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${
            message.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {[
          { id: 'lcs', name: 'Leopards Courier Service (LCS)', desc: 'Official API integration for automated consignment booking and real-time tracking across Pakistan.' },
          { id: 'postex', name: 'PostEx Logistics', desc: 'Direct digital booking with next-day cash on delivery remittance.' },
          { id: 'mnp', name: 'M&P Express', desc: 'Express courier network with automated dispatch manifests.' },
        ].map((provider) => {
          const isConnected = connections.some((c) => c.providerId === provider.id && c.isActive);
          return (
            <div key={provider.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-slate-900 text-sm">{provider.name}</h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                    {isConnected ? 'Connected' : 'Not Configured'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{provider.desc}</p>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4">
                <button
                  onClick={() => {
                    setSelectedProvider(provider.id);
                    setMessage(null);
                  }}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
                    isConnected ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm'
                  }`}
                >
                  {isConnected ? 'Manage Configuration' : 'Connect Provider'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Connect Provider Modal */}
      {selectedProvider && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm uppercase">Connect {selectedProvider}</h3>
              <button onClick={() => setSelectedProvider(null)} className="text-slate-400 hover:text-slate-600">×</button>
            </div>

            <form onSubmit={handleSaveConnection} className="p-6 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">API Key / Token *</label>
                <input
                  type="password"
                  required
                  value={credentials.apiKey}
                  onChange={(e) => setCredentials({ ...credentials, apiKey: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">API Password / Secret *</label>
                <input
                  type="password"
                  required
                  value={credentials.apiPassword}
                  onChange={(e) => setCredentials({ ...credentials, apiPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Merchant Account Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ACC-4912"
                  value={credentials.accountCode}
                  onChange={(e) => setCredentials({ ...credentials, accountCode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="testMode"
                  checked={testMode}
                  onChange={(e) => setTestMode(e.target.checked)}
                  className="rounded text-sky-600"
                />
                <label htmlFor="testMode" className="text-xs text-slate-600 font-medium">
                  Enable Sandbox / Test Mode (Simulates booking without live dispatch)
                </label>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md transition-all"
                >
                  Save Encrypted Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
