import express from 'express';
import {
  createWholesaleCustomer,
  listWholesaleCustomers,
  createWholesaleQuotation,
  listQuotations,
  convertQuotation,
  receiveCustomerKhataPayment,
} from './wholesaleController.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenantContext } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../auth/roles.js';

const router = express.Router();

router.use(authenticate, resolveTenantContext);

// Customers & Khata
router.post('/customers', requirePermission(PERMISSIONS.WHOLESALE_MANAGE), createWholesaleCustomer);
router.get('/customers', requirePermission(PERMISSIONS.WHOLESALE_MANAGE), listWholesaleCustomers);
router.post('/customers/:id/payments', requirePermission(PERMISSIONS.WHOLESALE_MANAGE), receiveCustomerKhataPayment);

// Quotations & Conversion
router.post('/quotations', requirePermission(PERMISSIONS.WHOLESALE_MANAGE), createWholesaleQuotation);
router.get('/quotations', requirePermission(PERMISSIONS.WHOLESALE_MANAGE), listQuotations);
router.post('/quotations/:id/convert', requirePermission(PERMISSIONS.WHOLESALE_MANAGE), convertQuotation);

export default router;
