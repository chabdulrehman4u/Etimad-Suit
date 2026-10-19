import express from 'express';
import {
  getTenantProfile,
  updateTenantProfile,
  listMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
  addCustomDomain,
  verifyCustomDomain,
} from './tenantController.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenantContext } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../auth/roles.js';
import { enforceQuota, requireEntitlement } from '../../middleware/entitlements.js';

const router = express.Router();

// All tenant routes require active authentication & verified tenant context
router.use(authenticate, resolveTenantContext);

router.get('/profile', getTenantProfile);
router.put('/profile', requirePermission(PERMISSIONS.TENANT_SETTINGS), updateTenantProfile);

// Staff Management
router.get('/members', requirePermission(PERMISSIONS.STAFF_MANAGE), listMembers);
router.post(
  '/members',
  requirePermission(PERMISSIONS.STAFF_MANAGE),
  enforceQuota('maxStaff'),
  inviteMember
);
router.put('/members/:membershipId', requirePermission(PERMISSIONS.STAFF_MANAGE), updateMemberRole);
router.delete('/members/:membershipId', requirePermission(PERMISSIONS.STAFF_MANAGE), removeMember);

// Domains
router.post(
  '/domains',
  requirePermission(PERMISSIONS.TENANT_SETTINGS),
  requireEntitlement('customDomainAllowed'),
  addCustomDomain
);
router.post(
  '/domains/:domain/verify',
  requirePermission(PERMISSIONS.TENANT_SETTINGS),
  requireEntitlement('customDomainAllowed'),
  verifyCustomDomain
);

export default router;

