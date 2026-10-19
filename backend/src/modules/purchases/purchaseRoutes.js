import express from 'express';
import {
  createSupplier,
  listSuppliers,
  createBatch,
  listBatches,
  receiveBatch,
} from './purchaseController.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenantContext } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../auth/roles.js';

const router = express.Router();

router.use(authenticate, resolveTenantContext);

// Suppliers
router.post('/suppliers', requirePermission(PERMISSIONS.PURCHASES_MANAGE), createSupplier);
router.get('/suppliers', requirePermission(PERMISSIONS.PURCHASES_MANAGE), listSuppliers);

// Purchase Batches
router.post('/batches', requirePermission(PERMISSIONS.PURCHASES_MANAGE), createBatch);
router.get('/batches', requirePermission(PERMISSIONS.PURCHASES_MANAGE), listBatches);
router.post('/batches/:id/receive', requirePermission(PERMISSIONS.PURCHASES_MANAGE), receiveBatch);

export default router;

