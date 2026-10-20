import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatPKR } from '@etimad/ui';

export const BillingManager = () => {
  const { authFetch } = useAuth();
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [subRes, plansRes] = await Promise.all([
        authFetch('/api/v1/subscriptions/current'),
        authFetch('/api/v1/subscriptions/plans'),
      ]);

      const subJson = await subRes.json();
      const plansJson = await plansRes.json();

      if (subJson.success) setSubscriptionData(subJson.data);
      if (plansJson.success) setPlans(plansJson.data || []);
    } catch (err) {
      console.error('Failed to load subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpgrade = async (planId) => {
    try {
      setUpgrading(true);
      setMessage(null);
      const res = await authFetch('/api/v1/subscriptions/upgrade', {
        method: 'POST',
        body: JSON.stringify({ planId, billingCycle: 'monthly' }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: json.message || 'Plan upgraded successfully!' });
        fetchData();
      } else {
        setMessage({ type: 'error', text: json.error?.message });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading plan quotas...</div>;
  }

  const plan = subscriptionData?.plan;
  const usage = subscriptionData?.usage;
  const subscription = subscriptionData?.subscription;

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-slate-100">
      <div className="pb-4 border-b border-slate-200">
        <h2 className="text-xl font-extrabold text-slate-800">SaaS Plan & Quota Entitlements</h2>
        <p className="text-xs text-slate-500">Monitor live resource consumption and manage subscription tier</p>
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

      {/* Current Plan Overview */}
      <div className="mt-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between max-w-4xl">
        <div>
          <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
            Current Tier
          </span>
          <h3 className="text-2xl font-black text-slate-900 mt-1">{plan?.name || 'Starter Plan'}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Status: <strong className="text-emerald-600 uppercase font-bold">{subscription?.status || 'Active'}</strong> | Billing: {subscription?.billingCycle || 'monthly'}
          </p>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400">Subscription Price</span>
          <p className="text-xl font-black text-slate-900">
            {formatPKR(subscription?.amount || plan?.price?.monthly || 0)}
            <span className="text-xs font-normal text-slate-400">/mo</span>
          </p>
        </div>
      </div>

      {/* Quota Progress Bars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 max-w-4xl">
        {[
          { label: 'Products in Catalog', current: usage?.products?.used || 0, limit: usage?.products?.limit, percent: usage?.products?.percentage || 0 },
          { label: 'Active Staff Seats', current: usage?.staff?.used || 0, limit: usage?.staff?.limit, percent: usage?.staff?.percentage || 0 },
          { label: 'Monthly Orders', current: usage?.orders?.used || 0, limit: usage?.orders?.limit, percent: usage?.orders?.percentage || 0 },
        ].map((item, idx) => (
          <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700">{item.label}</span>
              <span className="font-bold text-slate-900 font-mono">
                {item.current} / {item.limit === -1 ? '∞' : item.limit}
              </span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  item.percent >= 90 ? 'bg-rose-500' : (item.percent >= 70 ? 'bg-amber-500' : 'bg-sky-500')
                }`}
                style={{ width: `${Math.min(100, item.percent)}%` }}
              />
            </div>

            <p className="text-[11px] text-slate-400 text-right">
              {item.limit === -1 ? 'Unlimited quota' : `${item.percent}% utilized`}
            </p>
          </div>
        ))}
      </div>

      {/* Available Tiers for Upgrade */}
      <div className="mt-8 max-w-4xl space-y-4">
        <h3 className="font-extrabold text-slate-800 text-base">Upgrade Subscription Tier</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((p) => {
            const isCurrent = p._id === plan?._id;
            return (
              <div
                key={p._id}
                className={`p-5 rounded-2xl border flex flex-col justify-between shadow-sm transition-all ${
                  isCurrent ? 'bg-sky-50/50 border-sky-400 ring-2 ring-sky-500/20' : 'bg-white border-slate-200 hover:shadow'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-slate-900 text-sm">{p.name}</h4>
                    {isCurrent && <span className="text-[10px] bg-sky-600 text-white font-bold px-2 py-0.5 rounded">Active</span>}
                  </div>
                  <p className="text-xl font-black text-slate-900">
                    {formatPKR(p.price?.monthly)}
                    <span className="text-xs font-normal text-slate-400">/mo</span>
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">{p.description}</p>
                </div>

                <div className="pt-4 border-t border-slate-100 mt-4">
                  <button
                    onClick={() => handleUpgrade(p._id)}
                    disabled={isCurrent || upgrading}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
                      isCurrent
                        ? 'bg-slate-200 text-slate-500 cursor-default'
                        : 'bg-slate-900 hover:bg-slate-800 text-white shadow'
                    }`}
                  >
                    {isCurrent ? 'Current Plan' : 'Select Plan'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
