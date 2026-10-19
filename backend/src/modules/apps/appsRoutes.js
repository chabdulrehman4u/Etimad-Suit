import express from 'express';
import {
  listSupported,
  saveConnection,
  getConnections,
  removeConnection,
  bookShipment,
  trackShipment,
  receiveWebhook,
} from './appsController.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenantContext } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../auth/roles.js';
import { requireEntitlement } from '../../middleware/entitlements.js';

const router = express.Router();

// 1. PUBLIC WEBHOOK RECEIVER (Called by external couriers)
router.post('/webhooks/:providerId', receiveWebhook);

// 2. PROTECTED MERCHANT INTEGRATION ROUTES
const merchantRouter = express.Router();
merchantRouter.use(authenticate, resolveTenantContext);

merchantRouter.get('/supported', listSupported);
merchantRouter.post(
  '/connections',
  requirePermission(PERMISSIONS.APPS_CONFIGURE),
  requireEntitlement('appsAccessAllowed'),
  saveConnection
);
merchantRouter.get('/connections', requirePermission(PERMISSIONS.APPS_CONFIGURE), getConnections);
merchantRouter.delete('/connections/:providerId', requirePermission(PERMISSIONS.APPS_CONFIGURE), removeConnection);

merchantRouter.post(
  '/courier/book',
  requirePermission(PERMISSIONS.SHIPPING_BOOK),
  requireEntitlement('appsAccessAllowed'),
  bookShipment
);
merchantRouter.get('/courier/track/:providerId/:trackingNumber', requirePermission(PERMISSIONS.SHIPPING_BOOK), trackShipment);

router.use('/', merchantRouter);

export default router;
