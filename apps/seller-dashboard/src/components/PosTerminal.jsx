import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatPKR } from '@etimad/ui';

export const PosTerminal = () => {
  const { authFetch } = useAuth();
  const [scanQuery, setScanQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [customer, setCustomer] = useState({ name: 'Walk-in Retail Guest', phone: '03000000000' });
  const [paymentSplit, setPaymentSplit] = useState({ cash: 0, card: 0 });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [lastReceipt, setLastReceipt] = useState(null);

  const barcodeInputRef = useRef(null);

  // Check active cashier shift on mount
  useEffect(() => {
    const fetchShift = async () => {
      try {
        const res = await authFetch('/api/v1/pos/shifts/current');
        const json = await res.json();
        if (json.success) {
          setActiveShift(json.data);
        }
      } catch (err) {
        console.error('Shift fetch error:', err);
      }
    };
    fetchShift();
  }, []);

  // Open Shift Drawer
  const handleOpenShift = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/v1/pos/shifts/open', {
        method: 'POST',
        body: JSON.stringify({ openingFloat: 5000, registerId: 'REG-01' }),
      });
      const json = await res.json();
      if (json.success) {
        setActiveShift(json.data);
        setMessage({ type: 'success', text: 'Shift opened with Rs. 5,000 cash drawer float.' });
      } else {
        setMessage({ type: 'error', text: json.error?.message });
      }
    } finally {
      setLoading(false);
    }
  };

  // Barcode / SKU Scan Lookup
  const handleScan = async (e) => {
    e.preventDefault();
    if (!scanQuery.trim()) return;

    try {
      setLoading(true);
      const res = await authFetch(`/api/v1/pos/products/lookup?code=${encodeURIComponent(scanQuery.trim())}`);
      const json = await res.json();

      if (json.success && json.data) {
        const product = json.data;
        if (product.stock <= 0) {
          setMessage({ type: 'error', text: `Product "${product.name}" is OUT OF STOCK!` });
          return;
        }

        setCart((prev) => {
          const existing = prev.find((i) => i.productId === product._id);
          if (existing) {
            return prev.map((i) => (i.productId === product._id ? { ...i, quantity: i.quantity + 1 } : i));
          }
          return [
            ...prev,
            {
              productId: product._id,
              name: product.name,
              sku: product.sku,
              retailPrice: product.pricing?.retailPrice || 0,
              quantity: 1,
            },
          ];
        });

        setScanQuery('');
        setMessage({ type: 'success', text: `Added "${product.name}" to cart.` });
      } else {
        setMessage({ type: 'error', text: 'Item not found in catalog.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
      barcodeInputRef.current?.focus();
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.retailPrice * item.quantity, 0);

  // Auto-sync cash amount when cart changes
  useEffect(() => {
    setPaymentSplit({ cash: cartTotal, card: 0 });
  }, [cartTotal]);

  // Execute Authoritative Sale
  const handleCompleteSale = async () => {
    if (cart.length === 0) return;
    if (!activeShift) {
      setMessage({ type: 'error', text: 'Please open a cashier shift before billing sales.' });
      return;
    }

    try {
      setLoading(true);
      const res = await authFetch('/api/v1/pos/sales', {
        method: 'POST',
        body: JSON.stringify({
          shiftId: activeShift._id,
          customer,
          items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          splitPayments: [
            ...(paymentSplit.cash > 0 ? [{ method: 'cash', amount: paymentSplit.cash }] : []),
            ...(paymentSplit.card > 0 ? [{ method: 'card', amount: paymentSplit.card }] : []),
          ],
          idempotencyKey: `POS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || 'Sale execution failed');
      }

      setLastReceipt(json.data.order);
      setCart([]);
      setMessage({ type: 'success', text: `Sale completed! Order: ${json.data.order.orderNumber}` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-100">
      {/* Left Scanner & Item Grid */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        {/* Top Header & Shift Status */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-extrabold text-slate-800">Retail Point-of-Sale</h2>
            <p className="text-xs text-slate-500">Fast barcode lookup with atomic stock deduction</p>
          </div>

          <div>
            {activeShift ? (
              <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-emerald-800 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active Shift (Float: {formatPKR(activeShift.cashDrawer?.openingFloat)})</span>
              </div>
            ) : (
              <button
                onClick={handleOpenShift}
                disabled={loading}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow transition-all"
              >
                + Open Cashier Shift
              </button>
            )}
          </div>
        </div>

        {/* Message Banner */}
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

        {/* Barcode Scanner Input */}
        <form onSubmit={handleScan} className="mt-4 flex space-x-3">
          <input
            ref={barcodeInputRef}
            type="text"
            placeholder="Scan product barcode or enter SKU and press Enter..."
            value={scanQuery}
            onChange={(e) => setScanQuery(e.target.value)}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-mono shadow-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md transition-all"
          >
            Lookup Item
          </button>
        </form>

        {/* Scanned Cart Table */}
        <div className="flex-1 mt-4 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Item Details</span>
            <span>Quantity</span>
            <span>Unit Price</span>
            <span>Line Total</span>
            <span>Action</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                <span className="text-3xl">🛒</span>
                <p className="text-xs font-medium">Ready to scan products for checkout.</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="flex items-center justify-between p-3 text-sm">
                  <div className="w-1/3">
                    <p className="font-bold text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{item.sku}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() =>
                        setCart((prev) =>
                          prev
                            .map((i) => (i.productId === item.productId ? { ...i, quantity: i.quantity - 1 } : i))
                            .filter((i) => i.quantity > 0)
                        )
                      }
                      className="w-6 h-6 rounded bg-slate-100 text-slate-600 font-bold"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-bold">{item.quantity}</span>
                    <button
                      onClick={() =>
                        setCart((prev) =>
                          prev.map((i) => (i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i))
                        )
                      }
                      className="w-6 h-6 rounded bg-slate-100 text-slate-600 font-bold"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-slate-600">{formatPKR(item.retailPrice)}</span>
                  <span className="font-bold text-slate-900">{formatPKR(item.retailPrice * item.quantity)}</span>
                  <button
                    onClick={() => setCart((prev) => prev.filter((i) => i.productId !== item.productId))}
                    className="text-rose-500 hover:text-rose-700 text-xs font-semibold"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right Payment & Settlement Pane */}
      <div className="w-96 bg-white border-l border-slate-200 p-6 flex flex-col justify-between shadow-lg">
        <div className="space-y-4">
          <h3 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-3">Payment & Settlement</h3>

          {/* Customer Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-600">Customer Reference</label>
            <input
              type="text"
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          {/* Split Payment Calculation */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-600">Split Payment Mode</label>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Cash Received:</span>
                <input
                  type="number"
                  value={paymentSplit.cash}
                  onChange={(e) =>
                    setPaymentSplit({
                      ...paymentSplit,
                      cash: Number(e.target.value),
                      card: Math.max(0, cartTotal - Number(e.target.value)),
                    })
                  }
                  className="w-32 px-2 py-1 border border-slate-300 rounded text-right font-bold text-slate-800"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Card / Terminal:</span>
                <input
                  type="number"
                  value={paymentSplit.card}
                  onChange={(e) =>
                    setPaymentSplit({
                      ...paymentSplit,
                      card: Number(e.target.value),
                      cash: Math.max(0, cartTotal - Number(e.target.value)),
                    })
                  }
                  className="w-32 px-2 py-1 border border-slate-300 rounded text-right font-bold text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Total Breakdown */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Item Units:</span>
              <span className="font-semibold text-slate-700">{cart.reduce((s, i) => s + i.quantity, 0)}</span>
            </div>
            <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
              <span>Grand Total:</span>
              <span className="text-sky-600">{formatPKR(cartTotal)}</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4">
          <button
            onClick={handleCompleteSale}
            disabled={cart.length === 0 || loading || !activeShift}
            className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-lg transition-all active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? 'Processing Sale...' : `Charge ${formatPKR(cartTotal)}`}
          </button>
        </div>
      </div>
    </div>
  );
};

