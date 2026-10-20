import express from 'express';
import {
  getPlatformMetrics,
  listTenants,
  getTenantDetails,
  updateTenantStatus,
  changeTenantPlan,
  createNewPlan,
  updateExistingPlan,
  listAllPlans,
  archivePlan,
} from './platformAdminController.js';
import { authenticate, requirePlatformAdmin } from '../../middleware/auth.js';

const router = express.Router();

// Strict platform administrator guard on ALL routes in this router
router.use(authenticate, requirePlatformAdmin);

// Platform Overview
router.get('/metrics', getPlatformMetrics);

// Tenant Management
router.get('/tenants', listTenants);
router.get('/tenants/:id', getTenantDetails);
router.patch('/tenants/:id/status', updateTenantStatus);
router.post('/tenants/:id/plan', changeTenantPlan);

// SaaS Plan Management
router.get('/plans', listAllPlans);
router.post('/plans', createNewPlan);
router.put('/plans/:id', updateExistingPlan);
router.delete('/plans/:id', archivePlan);

export default router;

