import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { validatePakistaniPhone } from '@etimad/shared-validation';
import { formatPKR } from '@etimad/ui';

export const CheckoutModal = () => {
  const {
    tenantSlug,
    cart,
    isCheckoutOpen,
    setIsCheckoutOpen,
    clearCart,
    setOrderTrackingNumber,
    storeConfig,
  } = useStore();

  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    street: '',
    city: 'Rawalpindi',
  });
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [couponCode, setCouponCode] = useState('');
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [completedOrder, setCompletedOrder] = useState(null);

  const currencySymbol = storeConfig?.tenant?.currencySymbol || 'Rs.';

  // Request authoritative server pricing quote when items or coupon change
  useEffect(() => {
    if (!isCheckoutOpen || cart.length === 0) return;

    const fetchQuote = async () => {
      try {
        setQuoting(true);
        const res = await fetch(`/api/v1/storefront/${tenantSlug}/cart/quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
            couponCode: couponCode || undefined,
          }),
        });
        const json = await res.json();
        if (json.success) {
          setQuote(json.data);
        }
      } catch (err) {
        console.error('Quote error:', err);
      } finally {
        setQuoting(false);
      }
    };

    fetchQuote();
  }, [isCheckoutOpen, cart, couponCode, tenantSlug]);

  if (!isCheckoutOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate phone
    const phoneCheck = validatePakistaniPhone(customer.phone);
    if (!phoneCheck.isValid) {
      setError(phoneCheck.message);
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/v1/storefront/${tenantSlug}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            name: customer.name.trim(),
            phone: phoneCheck.normalized,
            shippingAddress: {
              street: customer.street.trim(),
              city: customer.city.trim(),
            },
          },
          items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          payment: { method: paymentMethod },
          couponCode: couponCode || undefined,
          idempotencyKey: `CHK-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || 'Failed to place order');
      }

      setCompletedOrder(json.data);
      clearCart();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-slate-800 text-lg">
            {completedOrder ? 'Order Confirmed!' : 'Express Checkout'}
          </h3>
          <button
            onClick={() => {
              setIsCheckoutOpen(false);
              setCompletedOrder(null);
            }}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {completedOrder ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h4 className="text-xl font-bold text-slate-900">Thank you for your order!</h4>
              <p className="text-sm text-slate-500 mt-1">
                Your order number is <strong className="text-slate-900 font-mono">{completedOrder.orderNumber}</strong>.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl text-left text-xs space-y-2 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Payable:</span>
                <span className="font-bold text-slate-900">
                  {formatPKR(completedOrder.financials?.grandTotal, currencySymbol)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Method:</span>
                <span className="font-semibold uppercase text-slate-800">{completedOrder.payment?.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Shipping To:</span>
                <span className="text-slate-700">{completedOrder.customer?.shippingAddress?.city}</span>
              </div>
            </div>

            <button
              onClick={() => {
                setOrderTrackingNumber(completedOrder.orderNumber);
                setIsCheckoutOpen(false);
                setCompletedOrder(null);
              }}
              className="w-full py-3 rounded-xl font-bold text-sm shadow-md transition-all btn-primary"
            >
              Track Your Order Now
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                {error}
              </div>
            )}

            {/* Customer Contact */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contact & Delivery</h4>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Muhammad Ali"
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Phone *</label>
                <input
                  type="tel"
                  required
                  placeholder="03001234567"
                  value={customer.phone}
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address *</label>
                  <input
                    type="text"
                    required
                    placeholder="House / Street / Area"
                    value={customer.street}
                    onChange={(e) => setCustomer({ ...customer, street: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lahore"
                    value={customer.city}
                    onChange={(e) => setCustomer({ ...customer, city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payment Method</h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cod')}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between text-xs font-semibold transition-all ${
                    paymentMethod === 'cod'
                      ? 'border-primary bg-sky-50/50 text-primary'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>Cash on Delivery</span>
                  {paymentMethod === 'cod' && <span className="text-primary font-bold">✓</span>}
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between text-xs font-semibold transition-all ${
                    paymentMethod === 'card'
                      ? 'border-primary bg-sky-50/50 text-primary'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>Debit / Credit Card</span>
                  {paymentMethod === 'card' && <span className="text-primary font-bold">✓</span>}
                </button>
              </div>
            </div>

            {/* Authoritative Order Summary */}
            {quote && (
              <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1.5 border border-slate-200">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{formatPKR(quote.financials?.subtotal, currencySymbol)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Delivery Fee:</span>
                  <span>
                    {quote.financials?.shippingFee === 0
                      ? 'FREE'
                      : formatPKR(quote.financials?.shippingFee, currencySymbol)}
                  </span>
                </div>
                {quote.financials?.discountTotal > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Discount:</span>
                    <span>-{formatPKR(quote.financials?.discountTotal, currencySymbol)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-slate-900 pt-1 border-t border-slate-200">
                  <span>Grand Total:</span>
                  <span>{formatPKR(quote.financials?.grandTotal, currencySymbol)}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || quoting}
              className="w-full py-3.5 rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.99] btn-primary disabled:opacity-50"
            >
              {submitting ? 'Confirming Order...' : 'Place Order'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

