import React from 'react';
import { useStore } from '../context/StoreContext';
import { formatPKR } from '@etimad/ui';

export const CartDrawer = () => {
  const {
    cart,
    cartSubtotal,
    isCartOpen,
    setIsCartOpen,
    updateQuantity,
    removeFromCart,
    setIsCheckoutOpen,
    storeConfig,
  } = useStore();

  const currencySymbol = storeConfig?.tenant?.currencySymbol || 'Rs.';

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={() => setIsCartOpen(false)}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-bold text-slate-800 text-lg">Your Cart ({cart.length})</h2>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cart.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-3">
                <svg className="w-12 h-12 mx-auto stroke-slate-300" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <p className="text-sm font-medium">Your cart is currently empty.</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="flex space-x-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  {item.image && (
                    <img src={item.image} alt={item.name} className="h-16 w-16 object-cover rounded-lg bg-white" />
                  )}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-800 text-sm line-clamp-1">{item.name}</h4>
                      <p className="text-xs text-slate-500 font-medium">{formatPKR(item.price, currencySymbol)}</p>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center border border-slate-300 rounded-md bg-white">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          -
                        </button>
                        <span className="px-2 text-xs font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          +
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.productId)}
                        className="text-xs text-rose-500 hover:text-rose-700 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer & Checkout */}
          {cart.length > 0 && (
            <div className="p-4 border-t border-slate-200 bg-white space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-bold text-slate-900 text-base">{formatPKR(cartSubtotal, currencySymbol)}</span>
              </div>
              <p className="text-[11px] text-slate-400">Shipping calculated authoritatively at checkout.</p>
              <button
                onClick={() => {
                  setIsCartOpen(false);
                  setIsCheckoutOpen(true);
                }}
                className="w-full py-3 rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.99] btn-primary"
              >
                Proceed to Checkout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

