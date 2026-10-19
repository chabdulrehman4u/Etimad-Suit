import express from 'express';
import {
  createOrder,
  listOrders,
  getOrderById,
  updateStatus,
} from './orderController.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenantContext } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../auth/roles.js';

const router = express.Router();

router.use(authenticate, resolveTenantContext);

router.get('/', requirePermission(PERMISSIONS.ORDERS_READ), listOrders);
router.post('/', createOrder); // Handled inside controller based on channel permission
router.get('/:id', requirePermission(PERMISSIONS.ORDERS_READ), getOrderById);
router.patch('/:id/status', updateStatus);

export default router;
