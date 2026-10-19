import express from 'express';
import {
  getPublicConfig,
  getTheme,
  updateThemeSettings,
  updateSections,
  publishThemeLayout,
  updateFeatureFlag,
} from './storefrontController.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenantContext, resolvePublicStorefrontTenant } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../auth/roles.js';

const router = express.Router();

// 1. PUBLIC STOREFRONT ROUTES (Accessible by storefront frontend)
router.get('/config', resolvePublicStorefrontTenant, getPublicConfig);
router.get('/:tenantSlug/config', resolvePublicStorefrontTenant, getPublicConfig);

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
