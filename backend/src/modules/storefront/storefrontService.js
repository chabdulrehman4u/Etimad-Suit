import mongoose from 'mongoose';
import { StorefrontTheme } from './StorefrontTheme.js';
import { Tenant } from '../tenants/Tenant.js';

/**
 * 1. Get or Initialize Default Storefront Theme for Tenant
 */
export const getOrCreateTheme = async (tenantId) => {
  let theme = await StorefrontTheme.findOne({ tenantId });

  if (!theme) {
    // Check if tenant has existing logo or colors in settings
    const tenant = await Tenant.findById(tenantId);
    const initialColors = {};
    if (tenant?.settings?.primaryColor) {
      initialColors.primary = tenant.settings.primaryColor;
    }
    if (tenant?.settings?.secondaryColor) {
      initialColors.secondary = tenant.settings.secondaryColor;
    }

    const initialBranding = {};
    if (tenant?.settings?.logoUrl) {
      initialBranding.logoUrl = tenant.settings.logoUrl;
    }
    if (tenant?.settings?.faviconUrl) {
      initialBranding.faviconUrl = tenant.settings.faviconUrl;
    }

    theme = new StorefrontTheme({
      tenantId,
      branding: { ...initialBranding },
      colors: { ...initialColors },
    });

    await theme.save();
  }

  return theme;
};

/**
 * 2. Update Theme Configuration (Colors, Typography, Topbar, Header, Footer, Features)
 */
export const updateTheme = async (tenantId, updateData = {}) => {
  const theme = await getOrCreateTheme(tenantId);

  // Dynamic deep updates for supported blocks
  if (updateData.branding) {
    theme.branding = { ...theme.branding.toObject(), ...updateData.branding };
  }

  if (updateData.colors) {
    theme.colors = { ...theme.colors.toObject(), ...updateData.colors };

    // Synchronize primary/secondary colors to Tenant.settings
    await Tenant.findByIdAndUpdate(tenantId, {
      $set: {
        'settings.primaryColor': theme.colors.primary,
        'settings.secondaryColor': theme.colors.secondary,
      },
    });
  }

  if (updateData.typography) {
    theme.typography = { ...theme.typography.toObject(), ...updateData.typography };
  }

  if (updateData.topbar) {
    theme.topbar = { ...theme.topbar.toObject(), ...updateData.topbar };
  }

  if (updateData.header) {
    theme.header = { ...theme.header.toObject(), ...updateData.header };
  }

  if (updateData.footer) {
    theme.footer = { ...theme.footer.toObject(), ...updateData.footer };
  }

  if (updateData.features) {
    theme.features = { ...theme.features.toObject(), ...updateData.features };
  }

  if (updateData.customCss != null) {
    theme.customCss = String(updateData.customCss);
  }

  await theme.save();
  return theme;
};

/**
 * 3. Update Draft Homepage Sections (Reorder, add, remove, configure blocks)
 */
export const updateDraftSections = async (tenantId, sections = []) => {
  if (!Array.isArray(sections)) {
    throw new Error('Sections must be an array of section definitions');
  }

  const theme = await getOrCreateTheme(tenantId);

  // Normalize order indices
  const normalizedSections = sections.map((sec, idx) => ({
    ...sec,
    order: sec.order != null ? sec.order : idx + 1,
  }));

  theme.homepageLayout.draftSections = normalizedSections;
  await theme.save();

  return theme.homepageLayout.draftSections;
};

/**
 * 4. Publish Homepage (Copies draft sections to live published sections)
 */
export const publishHomepage = async (tenantId) => {
  const theme = await getOrCreateTheme(tenantId);

  theme.homepageLayout.publishedSections = [
    ...theme.homepageLayout.draftSections.map((s) => ({ ...s.toObject() })),
  ];
  theme.homepageLayout.publishedAt = new Date();

  await theme.save();

  return {
    publishedSections: theme.homepageLayout.publishedSections,
    publishedAt: theme.homepageLayout.publishedAt,
  };
};

/**
 * 5. Dynamic Feature Flag Toggle (Real-time operational control)
 */
export const toggleFeature = async (tenantId, featureKey, enabled) => {
  const validFeatures = [
    'codEnabled',
    'onlinePaymentEnabled',
    'guestCheckoutEnabled',
    'wholesalePortalEnabled',
    'retailPosEnabled',
    'showStockBadges',
    'reviewsEnabled',
    'wishlistEnabled',
    'dealOfTheDayEnabled',
    'whatsappChatWidgetEnabled',
  ];

  if (!validFeatures.includes(featureKey)) {
    throw new Error(`Invalid feature key: "${featureKey}". Allowed: [${validFeatures.join(', ')}]`);
  }

  const theme = await getOrCreateTheme(tenantId);
  theme.features[featureKey] = Boolean(enabled);

  await theme.save();
  return { featureKey, enabled: theme.features[featureKey] };
};

/**
 * 6. Get Authoritative Public Storefront Bundle (Cached/optimized for storefront visitors)
 */
export const getPublicStorefrontBundle = async (tenantId) => {
  const [tenant, theme] = await Promise.all([
    Tenant.findById(tenantId).select('name slug subdomain customDomains settings status'),
    getOrCreateTheme(tenantId),
  ]);

  if (!tenant) {
    throw new Error('Tenant store not found');
  }

  return {
    store: {
      name: tenant.name,
      slug: tenant.slug,
      subdomain: tenant.subdomain,
      currency: tenant.settings?.currency || 'PKR',
      currencySymbol: tenant.settings?.currencySymbol || 'Rs.',
      timezone: tenant.settings?.timezone || 'Asia/Karachi',
    },
    branding: theme.branding,
    colors: theme.colors,
    typography: theme.typography,
    topbar: theme.topbar,
    header: theme.header,
    homepage: {
      sections: theme.homepageLayout.publishedSections
        .filter((sec) => sec.isEnabled !== false)
        .sort((a, b) => a.order - b.order),
      publishedAt: theme.homepageLayout.publishedAt,
    },
    footer: theme.footer,
    features: theme.features,
    customCss: theme.customCss,
  };
};

