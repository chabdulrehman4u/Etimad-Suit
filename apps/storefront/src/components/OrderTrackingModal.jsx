import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { getOrderStatusBadge, formatPKR, getApiBaseUrl } from '@etimad/ui';

export const OrderTrackingModal = ({ isOpen, onClose }) => {
  const { tenantSlug, orderTrackingNumber, setOrderTrackingNumber, storeConfig } = useStore();
  const [queryNum, setQueryNum] = useState(orderTrackingNumber || '');
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const currencySymbol = storeConfig?.tenant?.currencySymbol || 'Rs.';

  useEffect(() => {
    if (orderTrackingNumber) {
      setQueryNum(orderTrackingNumber);
      handleTrack(orderTrackingNumber);
    }
  }, [orderTrackingNumber]);

  if (!isOpen) return null;

  const handleTrack = async (targetOrderNumber) => {
    const num = targetOrderNumber || queryNum;
    if (!num || !num.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/v1/storefront/${tenantSlug}/orders/${num.trim()}/track`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message || 'Order not found');
      }

      setOrderData(json.data);
    } catch (err) {
      setError(err.message);
      setOrderData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-slate-800 text-lg">Track Your Order</h3>
          <button
            onClick={() => {
              onClose();
              setOrderTrackingNumber('');
            }}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="e.g. ORD-0001-XYZ"
              value={queryNum}
              onChange={(e) => setQueryNum(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none uppercase font-mono"
            />
            <button
              onClick={() => handleTrack()}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-xs font-bold btn-primary transition-all disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Track'}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          {orderData && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400">Order Reference</span>
                  <p className="font-bold font-mono text-slate-900 text-sm">{orderData.orderNumber}</p>
                </div>
                {(() => {
                  const badge = getOrderStatusBadge(orderData.fulfillmentStatus);
                  return (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                      {badge.label}
                    </span>
                  );
                })()}
              </div>

              {orderData.courier && (
                <div className="bg-sky-50 border border-sky-100 p-3 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between font-semibold text-sky-900">
                    <span>Courier Partner:</span>
                    <span className="uppercase">{orderData.courier.provider}</span>
                  </div>
                  <div className="flex justify-between text-sky-800">
                    <span>Tracking Number:</span>
                    <span className="font-mono">{orderData.courier.trackingNumber}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ordered Items</span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {orderData.items.map((i, idx) => (
                    <div key={idx} className="flex justify-between text-xs py-1 border-b border-slate-100">
                      <span className="text-slate-700">{i.quantity}x {i.name}</span>
                      <span className="font-semibold text-slate-900">{formatPKR(i.lineTotal, currencySymbol)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-900 pt-1">
                  <span>Total Amount:</span>
                  <span>{formatPKR(orderData.grandTotal, currencySymbol)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

