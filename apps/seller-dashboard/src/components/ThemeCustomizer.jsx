import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const DEFAULT_SANDBOX_THEME = {
  branding: {
    primaryColor: '#059669',
    secondaryColor: '#0f172a',
    accentColor: '#f59e0b',
    backgroundColor: '#f8fafc',
    surfaceColor: '#ffffff',
    textColor: '#0f172a',
    fontFamilyHeading: 'Inter, sans-serif',
    fontFamilyBody: 'Inter, sans-serif',
  },
  topbar: {
    isEnabled: true,
    announcementText: '🎉 Welcome to Etimad Mart! Free nationwide delivery on orders over Rs. 3,000',
  },
  homepageLayout: {
    draftSections: [
      { id: 'hero-1', type: 'HERO_BANNER', title: 'Main Hero Banner', isEnabled: true, order: 0 },
      { id: 'cat-1', type: 'CATEGORIES_GRID', title: 'Shop by Category', isEnabled: true, order: 1 },
      { id: 'feat-1', type: 'FEATURED_PRODUCTS', title: 'Top Featured Products', isEnabled: true, order: 2 },
      { id: 'promo-1', type: 'PROMOTIONAL_BANNER', title: 'Exclusive Seasonal Deals', isEnabled: true, order: 3 },
      { id: 'news-1', type: 'NEWSLETTER', title: 'Stay Updated', isEnabled: true, order: 4 },
    ],
  },
  footer: {
    copyrightText: '© 2026 Etimad Mart. All rights reserved. Powered by Etimad Suit SaaS.',
  },
  features: {
    codAllowed: true,
    guestCheckoutAllowed: true,
    showStockBadge: true,
    enableReviews: true,
    enableLiveChat: true,
  },
};

export const ThemeCustomizer = () => {
  const { authFetch, tenant, isDemo } = useAuth();
  const [theme, setTheme] = useState(isDemo ? DEFAULT_SANDBOX_THEME : null);
  const [loading, setLoading] = useState(!isDemo);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('colors');

  const fetchTheme = async () => {
    if (isDemo) return;

    try {
      setLoading(true);
      setFetchError(null);
      const res = await authFetch('/api/v1/storefront/theme');
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message || `Failed to fetch theme configuration (HTTP ${res.status})`);
      }

      setTheme(json.data);
    } catch (err) {
      setFetchError(`Backend Storefront CMS Error: ${err.message}. Please verify API connectivity.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTheme();
  }, [isDemo]);

  const handleSaveTheme = async (updates) => {
    try {
      setSaving(true);
      setMessage(null);

      if (isDemo) {
        setTheme((prev) => ({
          ...prev,
          ...updates,
          branding: { ...prev.branding, ...updates.branding },
          topbar: { ...prev.topbar, ...updates.topbar },
          footer: { ...prev.footer, ...updates.footer },
        }));
        setMessage({ type: 'success', text: 'Store design updated in sandbox mode!' });
        return;
      }

      const res = await authFetch('/api/v1/storefront/theme', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message || 'Failed to save theme settings');
      }

      setTheme(json.data);
      setMessage({ type: 'success', text: 'Store design updated in real-time!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handlePublishHomepage = async () => {
    try {
      setSaving(true);
      setMessage(null);

      if (isDemo) {
        setMessage({ type: 'success', text: 'Draft layout published to sandbox store!' });
        return;
      }

      const res = await authFetch('/api/v1/storefront/theme/publish', {
        method: 'POST',
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message || 'Failed to publish homepage layout');
      }

      setTheme(json.data.theme);
      setMessage({ type: 'success', text: 'Draft layout published to live storefront!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFeature = async (featureKey, enabled) => {
    try {
      setTheme((prev) => ({
        ...prev,
        features: { ...prev?.features, [featureKey]: enabled },
      }));

      if (!isDemo) {
        const res = await authFetch(`/api/v1/storefront/theme/features/${featureKey}`, {
          method: 'PATCH',
          body: JSON.stringify({ enabled }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          throw new Error(json?.error?.message || 'Failed to update feature');
        }
      }

      setMessage({ type: 'success', text: `Feature "${featureKey}" updated.` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-12 text-center text-slate-500">
        <p className="text-sm font-medium">Loading store customizer from authoritative backend...</p>
      </div>
    );
  }

  if (fetchError && !theme) {
    return (
      <div className="flex-1 p-8 bg-slate-100 flex items-center justify-center">
        <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-sm max-w-md w-full space-y-3 text-center">
          <span className="text-3xl">⚠️</span>
          <h3 className="text-base font-bold text-slate-800">Store Customizer Unavailable</h3>
          <p className="text-xs text-rose-700">{fetchError}</p>
          <button
            onClick={fetchTheme}
            className="w-full py-2 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700"
          >
            Retry Loading Theme
          </button>
        </div>
      </div>
    );
  }

  const branding = theme?.branding || {};
  const topbar = theme?.topbar || {};
  const footer = theme?.footer || {};
  const features = theme?.features || {};
  const draftSections = theme?.homepageLayout?.draftSections || [];

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden bg-slate-100">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">Dynamic Storefront CMS</h2>
          <p className="text-xs text-slate-500">
            Customize colors, homepage sections, footer links, and functional feature flags in real-time
          </p>
        </div>

        <div className="flex space-x-3">
          <a
            href={`http://localhost:3000/?tenant=${tenant?.slug || 'etimadmart'}`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 border border-slate-300 hover:bg-white text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            ↗ View Live Storefront
          </a>
          <button
            onClick={handlePublishHomepage}
            disabled={saving}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50"
          >
            {saving ? 'Publishing...' : 'Publish Live Layout'}
          </button>
        </div>
      </div>

      {/* Status Alert */}
      {message && (
        <div
          className={`mt-3 p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${
            message.type === 'error'
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      {/* Sub Navigation Tabs */}
      <div className="flex space-x-2 mt-4 border-b border-slate-200 pb-2">
        {[
          { id: 'colors', label: '🎨 Colors & Branding' },
          { id: 'homepage', label: '🏠 Homepage Sections' },
          { id: 'footer', label: '📋 Footer Builder' },
          { id: 'features', label: '⚡ Functional Feature Flags' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === tab.id
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab Content Area */}
      <div className="flex-1 mt-4 overflow-y-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        {/* 1. Colors & Branding */}
        {activeSubTab === 'colors' && (
          <div className="max-w-2xl space-y-6">
            <h3 className="font-bold text-slate-800 text-sm">Theme Color Palette</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Primary Brand Color</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={branding.primaryColor || '#059669'}
                    onChange={(e) =>
                      handleSaveTheme({ branding: { ...branding, primaryColor: e.target.value } })
                    }
                    className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300"
                  />
                  <input
                    type="text"
                    value={branding.primaryColor || '#059669'}
                    onChange={(e) =>
                      handleSaveTheme({ branding: { ...branding, primaryColor: e.target.value } })
                    }
                    className="w-28 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Secondary Header/Footer Color</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={branding.secondaryColor || '#0f172a'}
                    onChange={(e) =>
                      handleSaveTheme({ branding: { ...branding, secondaryColor: e.target.value } })
                    }
                    className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300"
                  />
                  <input
                    type="text"
                    value={branding.secondaryColor || '#0f172a'}
                    onChange={(e) =>
                      handleSaveTheme({ branding: { ...branding, secondaryColor: e.target.value } })
                    }
                    className="w-28 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h3 className="font-bold text-slate-800 text-sm">Top Announcement Bar</h3>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="topbarEnable"
                  checked={topbar.isEnabled !== false}
                  onChange={(e) =>
                    handleSaveTheme({ topbar: { ...topbar, isEnabled: e.target.checked } })
                  }
                  className="rounded text-sky-600 focus:ring-sky-500 h-4 w-4"
                />
                <label htmlFor="topbarEnable" className="text-xs font-semibold text-slate-700">
                  Enable Announcement Bar on Storefront
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Announcement Text</label>
                <input
                  type="text"
                  value={topbar.announcementText || ''}
                  onChange={(e) =>
                    handleSaveTheme({ topbar: { ...topbar, announcementText: e.target.value } })
                  }
                  placeholder="e.g. Free Delivery Nationwide on all orders above Rs. 2,999!"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* 2. Homepage Sections Builder */}
        {activeSubTab === 'homepage' && (
          <div className="max-w-3xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">Active Homepage Sections (Draft Mode)</h3>
              <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                Draft Mode - Click "Publish Live Layout" to go live
              </span>
            </div>

            <div className="space-y-3">
              {draftSections.map((sec, idx) => (
                <div key={sec.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-bold text-xs text-slate-800">{sec.title || sec.type.toUpperCase()}</p>
                      <p className="text-[11px] text-slate-400 capitalize">Type: {sec.type}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sec.isEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                      {sec.isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Footer Builder */}
        {activeSubTab === 'footer' && (
          <div className="max-w-2xl space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">Store Footer Customizer</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Copyright Text</label>
              <input
                type="text"
                value={footer.copyrightText || ''}
                onChange={(e) =>
                  handleSaveTheme({ footer: { ...footer, copyrightText: e.target.value } })
                }
                placeholder="e.g. © 2026 My Brand. All rights reserved."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>
        )}

        {/* 4. Functional Feature Flags */}
        {activeSubTab === 'features' && (
          <div className="max-w-2xl space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">Real-time Functional Feature Toggles</h3>
            <p className="text-xs text-slate-500">Enable or disable checkout and store behavior instantly without redeployment</p>

            <div className="space-y-3 pt-2">
              {[
                { key: 'codAllowed', label: 'Cash on Delivery (COD) Checkout', desc: 'Allows storefront buyers to place unpaid COD orders' },
                { key: 'guestCheckoutAllowed', label: 'Guest Checkout', desc: 'Allows buyers to order without creating customer accounts' },
                { key: 'showStockBadge', label: 'Stock Urgency Badges', desc: 'Displays low-stock count badges on product cards' },
                { key: 'enableReviews', label: 'Customer Reviews & Ratings', desc: 'Allows verified buyers to post star ratings' },
                { key: 'enableLiveChat', label: 'WhatsApp Live Chat Widget', desc: 'Enables quick WhatsApp assistance floating button' },
              ].map((flag) => (
                <div key={flag.key} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">{flag.label}</h4>
                    <p className="text-[11px] text-slate-500">{flag.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={features[flag.key] !== false}
                    onChange={(e) => handleToggleFeature(flag.key, e.target.checked)}
                    className="h-5 w-5 rounded text-sky-600 focus:ring-sky-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
