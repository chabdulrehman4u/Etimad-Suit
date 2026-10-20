import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getOrderStatusBadge, formatPKR } from '@etimad/ui';

export const OrdersManager = () => {
  const { authFetch, isDemo } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterChannel, setFilterChannel] = useState('');
  const [fetchError, setFetchError] = useState(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const url = filterChannel ? `/api/v1/orders?channel=${filterChannel}` : '/api/v1/orders';
      const res = await authFetch(url);
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message || `Failed to fetch orders (HTTP ${res.status})`);
      }

      setOrders(json.data || []);
    } catch (err) {
      if (isDemo) {
        setOrders([
          {
            _id: 'ord-demo-1',
            orderNumber: 'ORD-0001-DEMO',
            channel: 'online',
            customer: { name: 'Demo Online Buyer', phone: '03001234567' },
            financials: { grandTotal: 4999 },
            fulfillment: { status: 'confirmed' },
          },
          {
            _id: 'ord-demo-2',
            orderNumber: 'POS-0002-DEMO',
            channel: 'retail',
            customer: { name: 'Retail Walk-in', phone: '03000000000' },
            financials: { grandTotal: 3299 },
            fulfillment: { status: 'delivered' },
          },
        ]);
      } else {
        setFetchError(`Backend Order Pipeline Error: ${err.message}. Please verify API connectivity.`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [filterChannel]);

  const handleUpdateStatus = async (orderId, newStatus) => {
    if (isDemo) {
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, fulfillment: { ...o.fulfillment, status: newStatus } } : o))
      );
      return;
    }

    try {
      const res = await authFetch(`/api/v1/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json().catch(() => null);
      if (json && json.success) {
        fetchOrders();
      }
    } catch (err) {
      console.error('Status update failed:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden bg-slate-100">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">Canonical Order Pipeline</h2>
          <p className="text-xs text-slate-500">Unified orders across online store, retail POS counter, and wholesale</p>
        </div>

        <div className="flex space-x-2">
          {['', 'online', 'retail', 'wholesale'].map((ch) => (
            <button
              key={ch}
              onClick={() => setFilterChannel(ch)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                filterChannel === ch ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'
              }`}
            >
              {ch || 'All Channels'}
            </button>
          ))}
        </div>
      </div>

      {fetchError && (
        <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center space-x-2">
            <span>⚠️</span>
            <span>{fetchError}</span>
          </div>
          <button
            onClick={fetchOrders}
            className="px-3 py-1 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700"
          >
            Retry Connection
          </button>
        </div>
      )}

      <div className="flex-1 mt-4 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
          <span className="w-28">Order #</span>
          <span className="w-20">Channel</span>
          <span className="w-36">Customer</span>
          <span className="w-24 text-right">Total</span>
          <span className="w-24 text-center">Fulfillment</span>
          <span className="w-36 text-center">Actions</span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading orders from authoritative backend...</div>
          ) : orders.length === 0 ? (
            <div className="p-16 text-center text-xs text-slate-400 space-y-2">
              <span className="text-3xl">🧾</span>
              <p className="font-semibold text-slate-600">No orders recorded in this store pipeline yet.</p>
              <p className="text-slate-400">Orders created via online checkout or retail POS will appear here.</p>
            </div>
          ) : (
            orders.map((o) => {
              const badge = getOrderStatusBadge(o.fulfillment?.status);
              return (
                <div key={o._id} className="flex items-center justify-between p-3 text-xs">
                  <span className="w-28 font-mono font-bold text-slate-800">{o.orderNumber}</span>
                  <span className="w-20 capitalize font-semibold text-slate-600">{o.channel}</span>
                  <div className="w-36">
                    <p className="font-semibold text-slate-800 truncate">{o.customer?.name}</p>
                    <p className="text-[10px] text-slate-400">{o.customer?.phone}</p>
                  </div>
                  <span className="w-24 text-right font-bold text-slate-900">{formatPKR(o.financials?.grandTotal)}</span>
                  <div className="w-24 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="w-36 flex items-center justify-center space-x-1">
                    {o.fulfillment?.status === 'pending' && (
                      <button
                        onClick={() => handleUpdateStatus(o._id, 'confirmed')}
                        className="px-2 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded text-[10px] font-bold border border-sky-200"
                      >
                        Confirm
                      </button>
                    )}
                    {o.fulfillment?.status === 'confirmed' && (
                      <button
                        onClick={() => handleUpdateStatus(o._id, 'dispatched')}
                        className="px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-[10px] font-bold border border-indigo-200"
                      >
                        Dispatch
                      </button>
                    )}
                    {o.fulfillment?.status === 'dispatched' && (
                      <button
                        onClick={() => handleUpdateStatus(o._id, 'delivered')}
                        className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-[10px] font-bold border border-emerald-200"
                      >
                        Delivered
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
