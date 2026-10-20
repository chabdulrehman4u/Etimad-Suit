import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export const AppsManager = () => {
  const { authFetch, isDemo } = useAuth();
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [credentials, setCredentials] = useState({ apiKey: '', apiPassword: '', accountCode: '' });
  const [testMode, setTestMode] = useState(true);
  const [message, setMessage] = useState(null);
  const [fetchError, setFetchError] = useState(null);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      setFetchError(null);

      if (isDemo) {
        setConnections([
          { _id: 'c1', providerId: 'lcs', status: 'connected', testMode: true },
          { _id: 'c2', providerId: 'postex', status: 'connected', testMode: true },
        ]);
        return;
      }

      const res = await authFetch('/api/v1/apps/connections');
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message || `Failed to fetch app connections (HTTP ${res.status})`);
      }

      setConnections(json.data || []);
    } catch (err) {
      setFetchError(`Apps Service Error: ${err.message}. Please verify API connectivity.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, [isDemo]);

  const handleSaveConnection = async (e) => {
    e.preventDefault();
    if (!selectedProvider) return;

    try {
      if (isDemo) {
        setMessage({ type: 'success', text: `Successfully connected ${selectedProvider.toUpperCase()} in sandbox mode!` });
        setSelectedProvider(null);
        setCredentials({ apiKey: '', apiPassword: '', accountCode: '' });
        return;
      }

      const res = await authFetch('/api/v1/apps/connections', {
        method: 'POST',
        body: JSON.stringify({
          providerId: selectedProvider,
          credentials,
          testMode,
        }),
      });

      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        setMessage({ type: 'success', text: `Successfully connected ${selectedProvider.toUpperCase()}!` });
        setSelectedProvider(null);
        setCredentials({ apiKey: '', apiPassword: '', accountCode: '' });
        fetchConnections();
      } else {
        setMessage({ type: 'error', text: json?.error?.message || 'Connection failed.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-slate-100">
      <div className="pb-4 border-b border-slate-200">
        <h2 className="text-xl font-extrabold text-slate-800">Apps & Courier Integrations</h2>
        <p className="text-xs text-slate-500">Manage AES-256 encrypted courier connections for Leopards Courier, PostEx, M&P, and Trax</p>
      </div>

      {fetchError && (
        <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center space-x-2">
            <span>⚠️</span>
            <span>{fetchError}</span>
          </div>
          <button
            onClick={fetchConnections}
            className="px-3 py-1 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700"
          >
            Retry Connection
          </button>
        </div>
      )}

      {message && (
        <div
          className={`mt-4 p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${
            message.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading installed integrations from authoritative backend...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 max-w-4xl">
          {/* Leopards Courier */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-amber-500">🐆 LCS</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    connections.find((c) => c.providerId === 'lcs')
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {connections.find((c) => c.providerId === 'lcs') ? 'Active (AES-256)' : 'Disconnected'}
                </span>
              </div>
              <h4 className="font-extrabold text-slate-900 text-sm">Leopards Courier Service</h4>
              <p className="text-xs text-slate-500">
                Book express parcels nationwide with automated tracking updates and COD settlement reconciliations.
              </p>
            </div>

            <button
              onClick={() => setSelectedProvider('lcs')}
              className="mt-6 w-full py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs shadow-sm transition-all"
            >
              Configure Credentials
            </button>
          </div>

          {/* PostEx */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-blue-600">📦 PostEx</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    connections.find((c) => c.providerId === 'postex')
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {connections.find((c) => c.providerId === 'postex') ? 'Active (AES-256)' : 'Disconnected'}
                </span>
              </div>
              <h4 className="font-extrabold text-slate-900 text-sm">PostEx Courier & Financials</h4>
              <p className="text-xs text-slate-500">
                API integration for direct invoice creation, automated pickup requests, and invoice tracking.
              </p>
            </div>

            <button
              onClick={() => setSelectedProvider('postex')}
              className="mt-6 w-full py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs shadow-sm transition-all"
            >
              Configure Credentials
            </button>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {selectedProvider && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm">
                Connect {selectedProvider.toUpperCase()} Account
              </h3>
              <button onClick={() => setSelectedProvider(null)} className="text-slate-400 hover:text-slate-600">×</button>
            </div>

            <form onSubmit={handleSaveConnection} className="p-6 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">API Key / Token *</label>
                <input
                  type="password"
                  required
                  placeholder="Enter API Key"
                  value={credentials.apiKey}
                  onChange={(e) => setCredentials({ ...credentials, apiKey: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">API Password / Secret</label>
                <input
                  type="password"
                  placeholder="Enter API Password if applicable"
                  value={credentials.apiPassword}
                  onChange={(e) => setCredentials({ ...credentials, apiPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Merchant Account / Origin Code</label>
                <input
                  type="text"
                  placeholder="e.g. 001 or KHI-004"
                  value={credentials.accountCode}
                  onChange={(e) => setCredentials({ ...credentials, accountCode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="sandboxMode"
                  checked={testMode}
                  onChange={(e) => setTestMode(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500 h-4 w-4"
                />
                <label htmlFor="sandboxMode" className="text-xs font-semibold text-slate-700">
                  Enable Test / Sandbox Mode (Safe for staging)
                </label>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                >
                  Encrypt & Save Connection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
