import React, { createContext, useContext, useState, useEffect } from 'react';
import { injectTenantThemeVariables } from '@etimad/ui';

const StoreContext = createContext(null);

const DEFAULT_STORE_CONFIG = {
  tenant: {
    _id: 'default-flagship',
    name: 'Etimad Mart',
    slug: 'etimadmart',
    description: 'Premier Multi-Channel Retail & Wholesale Electronics Store',
    logoUrl: '',
    supportEmail: 'support@etimadmart.com',
    supportPhone: '+92 300 1234567',
    currencySymbol: 'Rs.',
  },
  branding: {
    primaryColor: '#059669',
    secondaryColor: '#0f172a',
    accentColor: '#f59e0b',
    backgroundColor: '#f8fafc',
    surfaceColor: '#ffffff',
    textColor: '#0f172a',
    fontFamilyHeading: 'Inter, sans-serif',
    fontFamilyBody: 'Inter, sans-serif',
    announcementBar: {
      enabled: true,
      text: '🎉 Welcome to Etimad Mart! Free nationwide delivery on orders over Rs. 3,000',
      linkUrl: '#',
      backgroundColor: '#059669',
      textColor: '#ffffff',
    },
  },
  homepage: {
    hero: {
      title: 'Powering Modern E-Commerce & Retail in Pakistan',
      subtitle: 'Shop the latest trending smart gadgets, accessories, and wholesale products at authoritative prices.',
      ctaText: 'Explore Collection',
      ctaUrl: '#catalog',
      bannerImageUrl: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=1600&auto=format&fit=crop&q=80',
    },
    sections: [
      { id: 'hero-1', type: 'HERO_BANNER', title: 'Main Hero Banner', isEnabled: true, order: 0 },
      { id: 'cat-1', type: 'CATEGORIES_GRID', title: 'Shop by Category', isEnabled: true, order: 1 },
      { id: 'feat-1', type: 'FEATURED_PRODUCTS', title: 'Top Featured Products', isEnabled: true, order: 2 },
      { id: 'promo-1', type: 'PROMOTIONAL_BANNER', title: 'Exclusive Seasonal Deals', isEnabled: true, order: 3 },
      { id: 'news-1', type: 'NEWSLETTER', title: 'Stay Updated', isEnabled: true, order: 4 },
    ],
  },
  footer: {
    copyrightText: '© 2026 Etimad Mart. All rights reserved. Powered by Etimad Suit SaaS.',
    socialLinks: {
      whatsapp: '+923001234567',
      facebook: 'https://facebook.com/etimadmart',
      instagram: 'https://instagram.com/etimadmart',
    },
    columns: [
      {
        title: 'Customer Service',
        links: [
          { label: 'Track Your Order', url: '#track' },
          { label: 'Return Policy (7 Days)', url: '#returns' },
          { label: 'Shipping & Delivery', url: '#shipping' },
        ],
      },
      {
        title: 'About Etimad',
        links: [
          { label: 'About Us', url: '#about' },
          { label: 'Wholesale B2B Inquiry', url: '#wholesale' },
          { label: 'Retail Outlets', url: '#outlets' },
        ],
      },
    ],
  },
  featureFlags: {
    enableCartDrawer: true,
    enableWhatsappButton: true,
    enableReviews: true,
    enableProductSearch: true,
    enableGuestCheckout: true,
  },
};

const DEFAULT_PRODUCTS = [
  {
    _id: 'prod-demo-1',
    name: 'Wireless Noise Cancelling Earbuds Pro',
    sku: 'EAR-PRO-BLK',
    category: 'Audio',
    pricing: { websitePrice: 4499, retailPrice: 4999, wholesalePrice: 3200 },
    inventory: { trackStock: true, stockQuantity: 45 },
    images: [{ url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80', isPrimary: true }],
    description: 'High-fidelity Bluetooth 5.3 earbuds with active noise cancellation and 36hr battery life.',
  },
  {
    _id: 'prod-demo-2',
    name: 'Fast Charging 65W GaN Power Adapter',
    sku: 'PWR-GAN-65W',
    category: 'Accessories',
    pricing: { websitePrice: 2899, retailPrice: 3299, wholesalePrice: 1900 },
    inventory: { trackStock: true, stockQuantity: 80 },
    images: [{ url: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80', isPrimary: true }],
    description: 'Universal ultra-compact dual Type-C fast charger for laptops and mobile devices.',
  },
  {
    _id: 'prod-demo-3',
    name: 'Smart AMOLED Fitness Tracker Watch',
    sku: 'WCH-FIT-AMOLED',
    category: 'Wearables',
    pricing: { websitePrice: 6200, retailPrice: 6999, wholesalePrice: 4500 },
    inventory: { trackStock: true, stockQuantity: 28 },
    images: [{ url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80', isPrimary: true }],
    description: 'IP68 waterproof health smartwatch with SpO2, heart-rate tracking, and 14-day battery.',
  },
  {
    _id: 'prod-demo-4',
    name: 'Braided 100W USB-C to USB-C Cable (2m)',
    sku: 'CBL-USBC-2M',
    category: 'Cables',
    pricing: { websitePrice: 850, retailPrice: 1100, wholesalePrice: 450 },
    inventory: { trackStock: true, stockQuantity: 150 },
    images: [{ url: 'https://images.unsplash.com/photo-1609081219090-a6d8173087ec?w=600&auto=format&fit=crop&q=80', isPrimary: true }],
    description: 'Durable nylon-braided fast charging cable with reinforced alloy connectors.',
  },
];

export const StoreProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [storeConfig, setStoreConfig] = useState(DEFAULT_STORE_CONFIG);
  const [products, setProducts] = useState(DEFAULT_PRODUCTS);
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
    return 'etimadmart';
  };

  const tenantSlug = getTenantIdentifier();

  // Load Storefront Configuration & Products
  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Apply default branding immediately for instantaneous paint
        injectTenantThemeVariables(DEFAULT_STORE_CONFIG.branding);

        // 1. Fetch Dynamic Config from backend if available
        const configRes = await fetch(`/api/v1/storefront/${tenantSlug}/config`).catch(() => null);
        
        if (configRes && configRes.ok) {
          const configJson = await configRes.json().catch(() => null);
          if (configJson && configJson.success && configJson.data) {
            setStoreConfig(configJson.data);
            if (configJson.data.branding) {
              injectTenantThemeVariables(configJson.data.branding);
            }
            if (configJson.data.tenant?.name) {
              document.title = `${configJson.data.tenant.name} | Official Store`;
            }
          }
        }

        // 2. Fetch Catalog from backend if available
        const catalogRes = await fetch(`/api/v1/storefront/${tenantSlug}/catalog`).catch(() => null);
        if (catalogRes && catalogRes.ok) {
          const catalogJson = await catalogRes.json().catch(() => null);
          if (catalogJson && catalogJson.success && Array.isArray(catalogJson.data) && catalogJson.data.length > 0) {
            setProducts(catalogJson.data);
          }
        }
      } catch (err) {
        console.warn('Backend unavailable, using default store preview:', err.message);
        // Fall back gracefully to default store configuration
        setStoreConfig(DEFAULT_STORE_CONFIG);
        setProducts(DEFAULT_PRODUCTS);
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
