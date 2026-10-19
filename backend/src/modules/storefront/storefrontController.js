import {
  getOrCreateTheme,
  updateTheme,
  updateDraftSections,
  publishHomepage,
  toggleFeature,
  getPublicStorefrontBundle,
} from './storefrontService.js';

/**
 * 1. Public Storefront Configuration
 * Publicly accessible by storefront frontend to render theme, layout, and feature flags
 */
export const getPublicConfig = async (req, res) => {
  try {
    const bundle = await getPublicStorefrontBundle(req.tenantId);
    return res.json({
      success: true,
      data: bundle,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'CONFIG_FETCH_FAILED', message: err.message },
    });
  }
};

/**
 * 2. Get Merchant Theme (including Draft & Published layout states)
 */
export const getTheme = async (req, res) => {
  try {
    const theme = await getOrCreateTheme(req.tenantId);
    return res.json({
      success: true,
      data: theme,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'THEME_FETCH_FAILED', message: err.message },
    });
  }
};

/**
 * 3. Update Theme (Colors, Footer, Topbar, Branding, Typography, Features)
 */
export const updateThemeSettings = async (req, res) => {
  try {
    const updatedTheme = await updateTheme(req.tenantId, req.body || {});
    return res.json({
      success: true,
      data: updatedTheme,
      message: 'Storefront theme and design updated successfully.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'THEME_UPDATE_FAILED', message: err.message },
    });
  }
};

/**
 * 4. Update Draft Homepage Sections (Reorder / add / remove / configure blocks)
 */
export const updateSections = async (req, res) => {
  try {
    const { sections } = req.body || {};
    if (!sections || !Array.isArray(sections)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Sections array is required.' },
      });
    }

    const draftSections = await updateDraftSections(req.tenantId, sections);
    return res.json({
      success: true,
      data: draftSections,
      message: 'Draft homepage sections saved successfully. Publish to apply to live storefront.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'SECTIONS_UPDATE_FAILED', message: err.message },
    });
  }
};

/**
 * 5. Publish Homepage Layout (Draft -> Live)
 */
export const publishThemeLayout = async (req, res) => {
  try {
    const result = await publishHomepage(req.tenantId);
    return res.json({
      success: true,
      data: result,
      message: 'Homepage layout published to live storefront successfully.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'PUBLISH_FAILED', message: err.message },
    });
  }
};

/**
 * 6. Quick Real-Time Feature Flag Toggle
 */
export const updateFeatureFlag = async (req, res) => {
  try {
    const { featureKey } = req.params;
    const { enabled } = req.body || {};

    if (enabled == null) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELD', message: '"enabled" boolean field is required.' },
      });
    }

    const result = await toggleFeature(req.tenantId, featureKey, enabled);
    return res.json({
      success: true,
      data: result,
      message: `Feature flag "${featureKey}" updated to ${enabled}.`,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'FLAG_UPDATE_FAILED', message: err.message },
    });
  }
};

