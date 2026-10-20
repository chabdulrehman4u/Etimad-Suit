import React, { createContext, useContext, useState, useEffect } from 'react';
import { injectTenantThemeVariables } from '@etimad/ui';

const StoreContext = createContext(null);

export const StoreProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [storeConfig, setStoreConfig] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [orderTrackingNumber, setOrderTrackingNumber] = useState('');

  // Determine active tenant slug (from URL param or window location)
  const getTenantIdentifier = () => {
    if (typeof window === 'undefined') return 'etimadmart';
    const params = new URLSearchParams(window.location.search);
    const tenantParam = params.get('tenant') || params.get('store');
    if (tenantParam) return tenantParam;

    const host = window.location.hostname;
    if (host.includes('.')) {
      const parts = host.split('.');
      if (parts.length >= 3 && parts[0] !== 'www') return parts[0];
    }
    return 'etimadmart'; // Flagship fallback
  };

  const tenantSlug = getTenantIdentifier();

  // Load Storefront Configuration & Products
  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        setLoading(true);
        // 1. Fetch Dynamic Config (Branding, Homepage CMS, Footer, Feature Flags)
        const configRes = await fetch(`/api/v1/storefront/${tenantSlug}/config`);
        const configJson = await configRes.json();

        if (!configJson.success) {
          throw new Error(configJson.error?.message || 'Store not found');
        }

        const config = configJson.data;
        setStoreConfig(config);

        // Apply dynamic branding variables & document metadata
        if (config.branding) {
          injectTenantThemeVariables(config.branding);
        }
        if (config.tenant?.name) {
          document.title = `${config.tenant.name} | Official Online Store`;
        }
        if (config.tenant?.faviconUrl) {
          const favicon = document.querySelector("link[rel*='icon']");
          if (favicon) favicon.href = config.tenant.faviconUrl;
        }

        // 2. Fetch Catalog
        const catalogRes = await fetch(`/api/v1/storefront/${tenantSlug}/catalog`);
        const catalogJson = await catalogRes.json();
        if (catalogJson.success) {
          setProducts(catalogJson.data || []);
        }
      } catch (err) {
        console.error('Failed to load store:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStoreData();
  }, [tenantSlug]);

  // Cart operations
  const addToCart = (product, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product._id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product._id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product._id,
          name: product.name,
          sku: product.sku,
          price: product.pricing?.websitePrice || product.pricing?.retailPrice || 0,
          image: product.images?.[0]?.url || '',
          quantity,
        },
      ];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantity } : item))
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const clearCart = () => setCart([]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <StoreContext.Provider
      value={{
        tenantSlug,
        storeConfig,
        products,
        loading,
        error,
        cart,
        cartCount,
        cartSubtotal,
        isCartOpen,
        setIsCartOpen,
        isCheckoutOpen,
        setIsCheckoutOpen,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        orderTrackingNumber,
        setOrderTrackingNumber,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
