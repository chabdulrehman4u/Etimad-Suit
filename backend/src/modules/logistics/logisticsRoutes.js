import express from 'express';
import {
  dispatchParcel,
  listParcels,
  inspectReturn,
  listReturns,
} from './logisticsController.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenantContext } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../auth/roles.js';

const router = express.Router();

router.use(authenticate, resolveTenantContext);

// Parcels
router.post('/parcels', requirePermission(PERMISSIONS.SHIPPING_BOOK), dispatchParcel);
router.get('/parcels', requirePermission(PERMISSIONS.SHIPPING_BOOK), listParcels);

// Returns & Inspection
router.post('/returns/inspect', requirePermission(PERMISSIONS.RETURNS_INSPECT), inspectReturn);
router.get('/returns', requirePermission(PERMISSIONS.RETURNS_INSPECT), listReturns);

export default router;

