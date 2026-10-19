import express from 'express';
import {
  lookupItem,
  openCashierShift,
  getShiftStatus,
  closeCashierShift,
  executePosSale,
} from './posController.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenantContext } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../auth/roles.js';

const router = express.Router();

router.use(authenticate, resolveTenantContext);

// Barcode Lookup
router.get('/lookup', requirePermission(PERMISSIONS.ORDERS_CREATE_POS), lookupItem);

// Cashier Shifts
router.post('/shifts/open', requirePermission(PERMISSIONS.ORDERS_CREATE_POS), openCashierShift);
router.get('/shifts/current', requirePermission(PERMISSIONS.ORDERS_CREATE_POS), getShiftStatus);
router.post('/shifts/:id/close', requirePermission(PERMISSIONS.ORDERS_CREATE_POS), closeCashierShift);

// POS Checkout
router.post('/sales', requirePermission(PERMISSIONS.ORDERS_CREATE_POS), executePosSale);

export default router;

