import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatPKR } from '@etimad/ui';

export const FinanceOverview = () => {
  const { authFetch } = useAuth();
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFinance = async () => {
      try {
        setLoading(true);
        const res = await authFetch('/api/v1/finance/balance-sheet');
        const json = await res.json();
        if (json.success) {
          setBalanceSheet(json.data);
        }
      } catch (err) {
        console.error('Failed to load balance sheet:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFinance();
  }, []);

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-slate-100">
      <div className="pb-4 border-b border-slate-200">
        <h2 className="text-xl font-extrabold text-slate-800">Double-Entry Financial Accounting</h2>
        <p className="text-xs text-slate-500">Live Balance Sheet, petty cash, bank liquidity, and business valuation</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Computing ledger balance sheet...</div>
      ) : balanceSheet ? (
        <div className="space-y-6 mt-6 max-w-4xl">
          {/* Balance Sheet Equation Banner */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Fundamental Accounting Invariant</span>
              <h3 className="text-lg font-extrabold mt-0.5">Assets = Liabilities + Owner's Equity</h3>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Total Net Worth</span>
              <p className="text-xl font-extrabold text-emerald-400">{formatPKR(balanceSheet.valuation?.totalEquity || 0)}</p>
            </div>
          </div>

          {/* 3 Main Financial Blocks */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Assets */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h4 className="font-bold text-slate-800 text-sm">Total Assets</h4>
                <span className="text-xs font-bold text-sky-600">{formatPKR(balanceSheet.valuation?.totalAssets || 0)}</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Petty Cash Drawer:</span>
                  <span className="font-semibold text-slate-800">{formatPKR(balanceSheet.assets?.cash || 0)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Bank Liquidity:</span>
                  <span className="font-semibold text-slate-800">{formatPKR(balanceSheet.assets?.bank || 0)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Inventory Stock Worth:</span>
                  <span className="font-semibold text-slate-800">{formatPKR(balanceSheet.assets?.inventory || 0)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Customer Receivables:</span>
                  <span className="font-semibold text-slate-800">{formatPKR(balanceSheet.assets?.receivables || 0)}</span>
                </div>
              </div>
            </div>

            {/* 2. Liabilities */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h4 className="font-bold text-slate-800 text-sm">Liabilities</h4>
                <span className="text-xs font-bold text-rose-600">{formatPKR(balanceSheet.valuation?.totalLiabilities || 0)}</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Supplier Payables:</span>
                  <span className="font-semibold text-slate-800">{formatPKR(balanceSheet.liabilities?.payables || 0)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Short-term Loans:</span>
                  <span className="font-semibold text-slate-800">{formatPKR(balanceSheet.liabilities?.loans || 0)}</span>
                </div>
              </div>
            </div>

            {/* 3. Equity & Profit */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h4 className="font-bold text-slate-800 text-sm">Owner's Equity</h4>
                <span className="text-xs font-bold text-emerald-600">{formatPKR(balanceSheet.valuation?.totalEquity || 0)}</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Capital Investment:</span>
                  <span className="font-semibold text-slate-800">{formatPKR(balanceSheet.equity?.capital || 0)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Retained Earnings:</span>
                  <span className="font-semibold text-slate-800">{formatPKR(balanceSheet.equity?.retainedEarnings || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
