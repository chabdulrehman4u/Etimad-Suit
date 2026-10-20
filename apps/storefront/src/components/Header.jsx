import React from 'react';
import { useStore } from '../context/StoreContext';

export const Header = ({ onOpenTracking }) => {
  const { storeConfig, cartCount, setIsCartOpen } = useStore();
  const tenant = storeConfig?.tenant;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & Store Name */}
        <div className="flex items-center space-x-3">
          {tenant?.logoUrl ? (
            <img src={tenant.logoUrl} alt={tenant.name} className="h-10 w-auto object-contain" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-xl shadow-sm">
              {tenant?.name?.charAt(0) || 'E'}
            </div>
          )}
          <span className="font-bold text-lg text-slate-900 tracking-tight">
            {tenant?.name || 'Online Store'}
          </span>
        </div>

        {/* Right Navigation & Cart */}
        <div className="flex items-center space-x-5">
          <button
            onClick={onOpenTracking}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Track Order
          </button>

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2 text-slate-700 hover:text-primary transition-colors rounded-full hover:bg-slate-100"
            aria-label="View shopping cart"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
