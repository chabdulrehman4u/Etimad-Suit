import React from 'react';
import { useAuth } from '../context/AuthContext';

export const Sidebar = ({ activeTab, setActiveTab }) => {
  const { tenant, user, logout } = useAuth();

  const navItems = [
    { id: 'pos', label: 'Retail POS Counter', icon: '🛒' },
    { id: 'orders', label: 'Canonical Orders', icon: '📦' },
    { id: 'products', label: 'Product Catalog', icon: '🏷️' },
    { id: 'theme', label: 'Dynamic Storefront CMS', icon: '🎨' },
    { id: 'finance', label: 'Double-Entry Finance', icon: '⚖️' },
    { id: 'apps', label: 'Apps & Couriers', icon: '🔌' },
    { id: 'billing', label: 'SaaS Plan & Quotas', icon: '💎' },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between h-full border-r border-slate-800 shadow-xl select-none">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500 flex items-center justify-center text-white font-extrabold text-lg shadow-md">
            ES
          </div>
          <div className="overflow-hidden">
            <h1 className="font-bold text-white text-sm tracking-tight truncate">
              {tenant?.name || 'Etimad Suit'}
            </h1>
            <p className="text-[11px] text-sky-400 font-mono truncate">
              {tenant?.subdomain}.etimadsuit.com
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === item.id
                  ? 'bg-sky-600 text-white shadow-md font-bold'
                  : 'hover:bg-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* User Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between mb-2">
          <div className="truncate pr-2">
            <p className="text-xs font-semibold text-white truncate">{user?.name || 'Staff'}</p>
            <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
};
