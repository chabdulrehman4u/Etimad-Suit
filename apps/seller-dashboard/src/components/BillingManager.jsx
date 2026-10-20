import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatPKR } from '@etimad/ui';

export const BillingManager = () => {
  const { authFetch, isDemo } = useAuth();
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [message, setMessage] = useState(null);
  const [fetchError, setFetchError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setFetchError(null);

      if (isDemo) {
        setSubscriptionData({
          plan: { name: 'Growth Tier (Sandbox)', price: 4999 },
          status: 'active',
          usage: { products: { used: 2, limit: 1000 }, staff: { used: 1, limit: 5 } },
        });
        setPlans([
          { _id: 'p1', name: 'Starter Tier', price: 1999, limits: { maxProducts: 200, maxStaffUsers: 2 } },
          { _id: 'p2', name: 'Growth Tier', price: 4999, limits: { maxProducts: 1000, maxStaffUsers: 5 } },
          { _id: 'p3', name: 'Enterprise Scale', price: 14999, limits: { maxProducts: 10000, maxStaffUsers: 25 } },
        ]);
        return;
      }

      const [subRes, plansRes] = await Promise.all([
        authFetch('/api/v1/subscriptions/current'),
        authFetch('/api/v1/subscriptions/plans'),
      ]);

      const subJson = await subRes.json().catch(() => null);
      const plansJson = await plansRes.json().catch(() => null);

      if (subRes.ok && subJson?.success) setSubscriptionData(subJson.data);
      if (plansRes.ok && plansJson?.success) setPlans(plansJson.data || []);

      if (!subRes.ok || !plansRes.ok) {
        throw new Error('Failed to retrieve subscription status from backend');
      }
    } catch (err) {
      setFetchError(`Billing Service Error: ${err.message}. Please verify API connectivity.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isDemo]);

  const handleUpgrade = async (planId) => {
    try {
      setUpgrading(true);
      setMessage(null);

      if (isDemo) {
        setMessage({ type: 'success', text: 'Plan upgraded successfully in sandbox mode!' });
        return;
      }

      const res = await authFetch('/api/v1/subscriptions/upgrade', {
        method: 'POST',
        body: JSON.stringify({ planId, billingCycle: 'monthly' }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        setMessage({ type: 'success', text: json.message || 'Plan upgraded successfully!' });
        fetchData();
      } else {
        setMessage({ type: 'error', text: json?.error?.message || 'Plan upgrade failed.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-slate-100">
      <div className="pb-4 border-b border-slate-200">
        <h2 className="text-xl font-extrabold text-slate-800">Subscription & Plan Entitlements</h2>
        <p className="text-xs text-slate-500">Manage SaaS plan tiers, usage quotas, staff user seats, and feature entitlements</p>
      </div>

      {fetchError && (
        <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center space-x-2">
            <span>⚠️</span>
            <span>{fetchError}</span>
          </div>
          <button
            onClick={fetchData}
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
        <div className="p-12 text-center text-xs text-slate-400">Loading plan quotas from authoritative backend...</div>
      ) : (
        <div className="space-y-6 mt-6 max-w-4xl">
          {/* Active Plan Usage Card */}
          {subscriptionData && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600">Active Subscription</span>
                  <h3 className="text-lg font-black text-slate-900">{subscriptionData.plan?.name || 'Growth Plan'}</h3>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Monthly Billing</span>
                  <p className="text-xl font-black text-slate-900">{formatPKR(subscriptionData.plan?.price || 4999)}/mo</p>
                </div>
              </div>

              {/* Quota Progress */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                    <span>Product Catalog Limit</span>
                    <span>{subscriptionData.usage?.products?.used || 0} / {subscriptionData.usage?.products?.limit || 1000}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-500 h-full rounded-full"
                      style={{
                        width: `${Math.min(100, ((subscriptionData.usage?.products?.used || 0) / (subscriptionData.usage?.products?.limit || 1000)) * 100)}%`,
                      }}
                    ></div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                    <span>Staff User Seats</span>
                    <span>{subscriptionData.usage?.staff?.used || 0} / {subscriptionData.usage?.staff?.limit || 5}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full"
                      style={{
                        width: `${Math.min(100, ((subscriptionData.usage?.staff?.used || 0) / (subscriptionData.usage?.staff?.limit || 5)) * 100)}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Available Plans */}
          <div>
            <h3 className="font-bold text-slate-800 text-sm mb-3">Available SaaS Plan Tiers</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((p) => (
                <div key={p._id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-base">{p.name}</h4>
                    <p className="text-xl font-black text-sky-600 mt-2">{formatPKR(p.price)}<span className="text-xs text-slate-400 font-normal">/mo</span></p>
                    <ul className="mt-4 space-y-2 text-xs text-slate-600">
                      <li>✓ Up to {p.limits?.maxProducts?.toLocaleString() || 1000} Products</li>
                      <li>✓ Up to {p.limits?.maxStaffUsers || 5} Staff Seats</li>
                      <li>✓ Retail POS & Multi-Branch</li>
                      <li>✓ Verified Couriers (LCS, PostEx)</li>
                    </ul>
                  </div>

                  <button
                    onClick={() => handleUpgrade(p._id)}
                    disabled={upgrading}
                    className="mt-6 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
                  >
                    {upgrading ? 'Processing...' : 'Select Plan'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
