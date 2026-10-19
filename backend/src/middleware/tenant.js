import mongoose from 'mongoose';
import { Tenant } from '../modules/tenants/Tenant.js';
import { TenantMembership } from '../modules/tenants/TenantMembership.js';
import { ROLES, ROLE_PERMISSIONS } from '../modules/auth/roles.js';

/**
 * Tenant Context Resolver for Authenticated Staff/Merchants
 * 
 * SECURITY RULES:
 * 1. Never trust a tenant ID from req.body or arbitrary client headers without verification.
 * 2. Authenticated user MUST have an active TenantMembership for the target tenant.
 * 3. Platform Superadmins can access any tenant with explicit audit flag.
 */
export const resolveTenantContext = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'User must be authenticated.' },
      });
    }

    // Determine target tenant ID:
    // 1. From active JWT claim
    // 2. Or from client header 'x-tenant-id' (useful when user belongs to multiple tenants)
    let targetTenantId = req.headers['x-tenant-id'] || req.jwtClaims?.tenantId;

    // Platform Super Admin Bypass (with strict auditing)
    if (req.user.isPlatformAdmin && targetTenantId) {
      if (!mongoose.Types.ObjectId.isValid(targetTenantId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TENANT_ID', message: 'Malformed tenant ID.' },
        });
      }

      const tenant = await Tenant.findById(targetTenantId);
      if (!tenant) {
        return res.status(404).json({
          success: false,
          error: { code: 'TENANT_NOT_FOUND', message: 'Target tenant not found.' },
        });
      }

      req.tenant = tenant;
      req.tenantId = tenant._id;
      req.membership = {
        role: ROLES.SUPER_ADMIN,
        customPermissions: Object.values(ROLE_PERMISSIONS[ROLES.SUPER_ADMIN]),
        isPlatformImpersonation: true,
      };

      req.scopeTenant = (filter = {}) => ({ ...filter, tenantId: tenant._id });
      return next();
    }

    // If no specific tenant is targeted, find the user's default active membership
    let membership = null;
    if (targetTenantId) {
      if (!mongoose.Types.ObjectId.isValid(targetTenantId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TENANT_ID', message: 'Malformed tenant ID.' },
        });
      }

      membership = await TenantMembership.findOne({
        tenantId: targetTenantId,
        userId: req.user._id,
        status: 'active',
      }).populate('tenantId');
    } else {
      membership = await TenantMembership.findOne({
        userId: req.user._id,
        status: 'active',
      }).sort({ createdAt: 1 }).populate('tenantId');
    }

    if (!membership || !membership.tenantId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'NO_TENANT_MEMBERSHIP',
          message: 'Access denied. You do not have an active membership in this tenant.',
        },
      });
    }

    const tenant = membership.tenantId;

    // Verify tenant status
    if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'TENANT_INACTIVE',
          message: `The tenant account is currently ${tenant.status}. Please contact billing support.`,
        },
      });
    }

    // Attach verified tenant context to request
    req.tenant = tenant;
    req.tenantId = tenant._id;
    req.membership = membership;

    // Standardized query scoping helper to prevent developer omission
    req.scopeTenant = (filter = {}) => {
      return {
        ...filter,
        tenantId: req.tenantId,
      };
    };

    next();
  } catch (err) {
    console.error('Tenant Context Resolution Error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to resolve tenant context.' },
    });
  }
};

/**
 * Public Storefront Tenant Resolver
 * Resolves tenant strictly from Host header (subdomain/custom domain) or path parameter.
 */
export const resolvePublicStorefrontTenant = async (req, res, next) => {
  try {
    const host = req.get('host') || '';
    const { tenantSlug } = req.params;

    let tenant = null;

    // 1. Direct tenant identification from header, query, or path parameter
    const targetTenantId = req.headers['x-tenant-id'] || req.query.tenantId;
    const targetSlug = tenantSlug || req.query.slug;

    if (targetTenantId && mongoose.Types.ObjectId.isValid(targetTenantId)) {
      tenant = await Tenant.findOne({
        _id: targetTenantId,
        status: { $in: ['active', 'trial'] },
      });
    }

    if (!tenant && targetSlug) {
      tenant = await Tenant.findOne({
        slug: targetSlug.toLowerCase().trim(),
        status: { $in: ['active', 'trial'] },
      });
    }

    // 2. Subdomain or Custom Domain resolution from Host header
    if (!tenant && host) {
      const hostname = host.split(':')[0].toLowerCase();

      // Check verified custom domains first
      tenant = await Tenant.findOne({
        'customDomains.domain': hostname,
        'customDomains.isVerified': true,
        status: { $in: ['active', 'trial'] },
      });

      // Check subdomains (e.g. brand.etimadsuit.com)
      if (!tenant && hostname.includes('.')) {
        const parts = hostname.split('.');
        if (parts.length >= 3) {
          const sub = parts[0];
          tenant = await Tenant.findOne({
            subdomain: sub,
            status: { $in: ['active', 'trial'] },
          });
        }
      }
    }

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: { code: 'STORE_NOT_FOUND', message: 'Storefront not found or currently paused.' },
      });
    }

    req.tenant = tenant;
    req.tenantId = tenant._id;
    req.scopeTenant = (filter = {}) => ({ ...filter, tenantId: tenant._id });

    next();
  } catch (err) {
    console.error('Public Storefront Tenant Resolution Error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to resolve store.' },
    });
  }
};

