import { Plan } from '../modules/subscriptions/Plan.js';
import { getDefaultPlan } from '../modules/subscriptions/subscriptionsService.js';
import { Product } from '../modules/products/Product.js';
import { TenantMembership } from '../modules/tenants/TenantMembership.js';
import { Order } from '../modules/orders/Order.js';
import { ROLES } from '../modules/auth/roles.js';

/**
 * Resolves the tenant's current plan (cached on req)
 */
export const getTenantPlan = async (req) => {
  if (req.plan) return req.plan;

  let plan = null;
  if (req.tenant?.planId) {
    if (req.tenant.planId.features) {
      plan = req.tenant.planId;
    } else {
      plan = await Plan.findById(req.tenant.planId);
    }
  }

  if (!plan) {
    plan = await getDefaultPlan();
  }

  req.plan = plan;
  return plan;
};

/**
 * Middleware: Require a specific feature entitlement (e.g. 'customDomainAllowed', 'appsAccessAllowed')
 * Returns HTTP 403 FEATURE_NOT_ENTITLED if feature is not in the plan.
 */
export const requireEntitlement = (featureFlag) => {
  return async (req, res, next) => {
    try {
      // Platform super admins bypass entitlement restrictions
      if (req.user?.isPlatformAdmin || req.membership?.role === ROLES.SUPER_ADMIN) {
        return next();
      }

      const plan = await getTenantPlan(req);

      if (!plan || !plan.features || !plan.features[featureFlag]) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FEATURE_NOT_ENTITLED',
            message: `Your current subscription plan (${plan?.name || 'Current'}) does not include '${featureFlag}'. Upgrade your plan to access this feature.`,
            requiredFeature: featureFlag,
            currentPlan: plan?.name || 'Default',
          },
        });
      }

      next();
    } catch (err) {
      console.error('Entitlement check error:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to verify plan entitlements.' },
      });
    }
  };
};

/**
 * Middleware: Enforce resource quota limits (e.g. 'maxProducts', 'maxStaff', 'maxOrdersPerMonth')
 * Returns HTTP 402 QUOTA_EXCEEDED with upgrade instructions if limit reached.
 */
export const enforceQuota = (resourceKey) => {
  return async (req, res, next) => {
    try {
      // Platform super admins bypass quota restrictions
      if (req.user?.isPlatformAdmin || req.membership?.role === ROLES.SUPER_ADMIN) {
        return next();
      }

      const plan = await getTenantPlan(req);
      const limit = plan?.quotas?.[resourceKey];

      // Unlimited if -1 or not set
      if (limit === undefined || limit === null || limit === -1) {
        return next();
      }

      let currentUsage = 0;
      let resourceLabel = resourceKey;

      if (resourceKey === 'maxProducts') {
        resourceLabel = 'Product';
        currentUsage = await Product.countDocuments({ tenantId: req.tenantId });
      } else if (resourceKey === 'maxStaff') {
        resourceLabel = 'Staff member';
        currentUsage = await TenantMembership.countDocuments({
          tenantId: req.tenantId,
          status: 'active',
        });
      } else if (resourceKey === 'maxOrdersPerMonth') {
        resourceLabel = 'Monthly order';
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        currentUsage = await Order.countDocuments({
          tenantId: req.tenantId,
          createdAt: { $gte: startOfMonth },
        });
      }

      if (currentUsage >= limit) {
        return res.status(402).json({
          success: false,
          error: {
            code: 'QUOTA_EXCEEDED',
            message: `${resourceLabel} quota limit reached (${currentUsage}/${limit}). Please upgrade your subscription plan to add more.`,
            resource: resourceKey,
            currentUsage,
            limit,
            currentPlan: plan.name,
          },
        });
      }

      next();
    } catch (err) {
      console.error('Quota enforcement error:', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to enforce resource quota.' },
      });
    }
  };
};

