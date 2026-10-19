import express from 'express';
import {
  listProducts,
  createProduct,
  getProductById,
  updateProduct,
  deleteProduct,
} from './productController.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenantContext } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../auth/roles.js';

const router = express.Router();

router.use(authenticate, resolveTenantContext);

router.get('/', requirePermission(PERMISSIONS.CATALOG_READ), listProducts);
router.post('/', requirePermission(PERMISSIONS.CATALOG_WRITE), createProduct);
router.get('/:id', requirePermission(PERMISSIONS.CATALOG_READ), getProductById);
router.put('/:id', requirePermission(PERMISSIONS.CATALOG_WRITE), updateProduct);
router.delete('/:id', requirePermission(PERMISSIONS.CATALOG_WRITE), deleteProduct);

export default router;

