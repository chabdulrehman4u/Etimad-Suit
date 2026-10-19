import express from 'express';
import {
  getCurrentSubscription,
  getPublicPlans,
  upgradeTenantPlan,
  cancelCurrentSubscription,
} from './subscriptionsController.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenantContext } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../auth/roles.js';

const router = express.Router();

// Public plans list accessible to all authenticated users
router.get('/plans', authenticate, getPublicPlans);

// Tenant-scoped billing endpoints require tenant context & TENANT_BILLING permission
router.use(authenticate, resolveTenantContext);

router.get('/current', getCurrentSubscription);
router.post('/upgrade', requirePermission(PERMISSIONS.TENANT_BILLING), upgradeTenantPlan);
router.post('/cancel', requirePermission(PERMISSIONS.TENANT_BILLING), cancelCurrentSubscription);

export default router;
