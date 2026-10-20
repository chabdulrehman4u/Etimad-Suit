import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getOrderStatusBadge, formatPKR } from '@etimad/ui';

export const OrdersManager = () => {
  const { authFetch } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterChannel, setFilterChannel] = useState('');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const url = filterChannel ? `/api/v1/orders?channel=${filterChannel}` : '/api/v1/orders';
      const res = await authFetch(url);
      const json = await res.json();
      if (json.success) {
        setOrders(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [filterChannel]);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      const res = await authFetch(`/api/v1/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
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
            <div className="p-8 text-center text-xs text-slate-400">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">No orders found.</div>
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
