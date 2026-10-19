import express from 'express';
import {
  getBalances,
  getLedger,
  executeAdjustment,
} from './inventoryController.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenantContext } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../auth/roles.js';

const router = express.Router();

router.use(authenticate, resolveTenantContext);

router.get('/balances', requirePermission(PERMISSIONS.INVENTORY_READ), getBalances);
router.get('/ledger', requirePermission(PERMISSIONS.INVENTORY_READ), getLedger);
router.post('/adjustments', requirePermission(PERMISSIONS.INVENTORY_ADJUST), executeAdjustment);

export default router;
