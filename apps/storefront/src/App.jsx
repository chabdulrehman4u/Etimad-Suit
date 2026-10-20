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
  const { error, orderTrackingNumber } = useStore();
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 space-y-3">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h2 className="text-xl font-bold text-slate-900">Storefront Unavailable</h2>
          <p className="text-sm text-slate-500">{error}</p>
          <p className="text-xs text-slate-400">Please verify the store domain or contact platform support.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
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

