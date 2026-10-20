import React, { useState } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { AnnouncementBar } from './components/AnnouncementBar';
import { Header } from './components/Header';
import { HeroBanner } from './components/HeroBanner';
import { ProductGrid } from './components/ProductGrid';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { OrderTrackingModal } from './components/OrderTrackingModal';
import { Footer } from './components/Footer';

const StoreContent = () => {
  const { error, orderTrackingNumber, retryConnection, enableDemoMode, isDemoMode, disableDemoMode } = useStore();
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);

  if (error && !isDemoMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-lg w-full border border-slate-200 space-y-4">
          <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold">
            !
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Authoritative Storefront Unavailable</h2>
            <p className="text-xs text-rose-700 mt-2 bg-rose-50 p-3 rounded-xl border border-rose-200 text-left font-mono">
              {error}
            </p>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            The storefront is configured to pull live inventory and branding from the Etimad Suit authoritative backend.
            Please verify the backend server is running and accessible.
          </p>

          <div className="pt-2 space-y-2">
            <button
              onClick={retryConnection}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md transition-all"
            >
              🔄 Retry Backend Connection
            </button>
            <button
              onClick={enableDemoMode}
              className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all"
            >
              ⚡ Explore Demo Store Sandbox (Simulation)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Explicit Demo Sandbox Warning Banner */}
      {isDemoMode && (
        <div className="bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-bold flex items-center justify-between shadow-sm z-50">
          <div className="flex items-center space-x-2">
            <span>⚠️</span>
            <span>
              <strong>OFFLINE DEMO STORE PREVIEW:</strong> Displaying sample product catalog. Backend is currently offline or in sandbox mode.
            </span>
          </div>
          <button
            onClick={disableDemoMode}
            className="text-[10px] bg-slate-950 text-white hover:bg-slate-800 px-2 py-0.5 rounded font-mono"
          >
            Switch to Live Backend
          </button>
        </div>
      )}

      <AnnouncementBar />
      <Header onOpenTracking={() => setIsTrackingOpen(true)} />

      <main className="flex-1">
        <HeroBanner />
        <ProductGrid />
      </main>

      <Footer />

      {/* Slide-out Cart Drawer */}
      <CartDrawer />

      {/* Authoritative Checkout Modal */}
      <CheckoutModal />

      {/* Customer Order Tracking Modal */}
      <OrderTrackingModal
        isOpen={isTrackingOpen || Boolean(orderTrackingNumber)}
        onClose={() => setIsTrackingOpen(false)}
      />
    </div>
  );
};

export const App = () => {
  return (
    <StoreProvider>
      <StoreContent />
    </StoreProvider>
  );
};

export default App;
