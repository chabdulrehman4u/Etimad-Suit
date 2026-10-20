import express from 'express';
import {
  getPublicConfig,
  getTheme,
  updateThemeSettings,
  updateSections,
  publishThemeLayout,
  updateFeatureFlag,
  getPublicCatalog,
  getPublicProductDetails,
  calculatePublicCart,
  createPublicOnlineOrder,
  trackPublicOrder,
} from './storefrontController.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenantContext, resolvePublicStorefrontTenant } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../auth/roles.js';

const router = express.Router();

// 1. PUBLIC STOREFRONT ROUTES (Accessible by storefront frontend via host subdomain/custom domain or slug)
// Config & Dynamic CMS Branding
router.get('/config', resolvePublicStorefrontTenant, getPublicConfig);
router.get('/:tenantSlug/config', resolvePublicStorefrontTenant, getPublicConfig);

// Public Catalog
router.get('/catalog', resolvePublicStorefrontTenant, getPublicCatalog);
router.get('/:tenantSlug/catalog', resolvePublicStorefrontTenant, getPublicCatalog);
router.get('/catalog/:identifier', resolvePublicStorefrontTenant, getPublicProductDetails);
router.get('/:tenantSlug/catalog/:identifier', resolvePublicStorefrontTenant, getPublicProductDetails);

// Public Cart Calculation & Checkout
router.post('/cart/quote', resolvePublicStorefrontTenant, calculatePublicCart);
router.post('/:tenantSlug/cart/quote', resolvePublicStorefrontTenant, calculatePublicCart);
router.post('/orders', resolvePublicStorefrontTenant, createPublicOnlineOrder);
router.post('/:tenantSlug/orders', resolvePublicStorefrontTenant, createPublicOnlineOrder);

// Public Order Tracking
router.get('/orders/:orderNumber/track', resolvePublicStorefrontTenant, trackPublicOrder);
router.get('/:tenantSlug/orders/:orderNumber/track', resolvePublicStorefrontTenant, trackPublicOrder);

// 2. MERCHANT MANAGEMENT ROUTES (Protected by RBAC & Tenant Scoping)
const merchantRouter = express.Router();
merchantRouter.use(authenticate, resolveTenantContext, requirePermission(PERMISSIONS.TENANT_SETTINGS));

merchantRouter.get('/', getTheme);
merchantRouter.put('/', updateThemeSettings);
merchantRouter.put('/sections', updateSections);
merchantRouter.post('/publish', publishThemeLayout);
merchantRouter.patch('/features/:featureKey', updateFeatureFlag);

router.use('/theme', merchantRouter);
router.use('/features', merchantRouter);

export default router;

