import { Tenant } from '../tenants/Tenant.js';
import { User } from '../auth/User.js';
import { Order } from '../orders/Order.js';
import { Plan } from '../subscriptions/Plan.js';
import { Subscription } from '../subscriptions/Subscription.js';
import {
  createPlan,
  updatePlan,
  listPlans,
  assignPlanToTenant,
  getTenantSubscriptionWithUsage,
} from '../subscriptions/subscriptionsService.js';

/**
 * 1. Calculate Authoritative Platform-Wide Metrics
 */
export const getPlatformOverviewMetrics = async () => {
  const [
    totalTenants,
    activeTenants,
    suspendedTenants,
    trialTenants,
    totalUsers,
    totalOrders,
    gmvAgg,
    activeSubs,
  ] = await Promise.all([
    Tenant.countDocuments(),
    Tenant.countDocuments({ status: 'active' }),
    Tenant.countDocuments({ status: 'suspended' }),
    Tenant.countDocuments({ status: 'trial' }),
    User.countDocuments(),
    Order.countDocuments(),
    Order.aggregate([
      { $match: { 'payment.status': { $in: ['paid', 'partially_paid', 'pending'] } } },
      { $group: { _id: null, gmv: { $sum: '$financials.grandTotal' } } },
    ]),
    Subscription.find({ status: { $in: ['active', 'trialing'] } }).populate('planId'),
  ]);

  const platformGmv = gmvAgg[0]?.gmv || 0;

  let monthlyRecurringRevenue = 0;
  for (const sub of activeSubs) {
    if (sub.planId?.price) {
      if (sub.billingCycle === 'yearly') {
        monthlyRecurringRevenue += Math.round((sub.planId.price.yearly || 0) / 12);
      } else {
        monthlyRecurringRevenue += sub.planId.price.monthly || 0;
      }
    }
  }

  return {
    tenants: {
      total: totalTenants,
      active: activeTenants,
      suspended: suspendedTenants,
      trial: trialTenants,
    },
    users: {
      total: totalUsers,
    },
    orders: {
      total: totalOrders,
      platformGmv,
    },
    subscriptions: {
      activeSubscribers: activeSubs.length,
      monthlyRecurringRevenue,
    },
  };
};

/**
 * 2. List All Tenants with Search & Pagination (Platform Admin)
 */
export const listAllTenants = async ({ search = '', status = '', page = 1, limit = 20 } = {}) => {
  const query = {};
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { slug: { $regex: search, $options: 'i' } },
      { subdomain: { $regex: search, $options: 'i' } },
    ];
  }

  const numericPage = Math.max(1, parseInt(page, 10) || 1);
  const numericLimit = Math.max(1, parseInt(limit, 10) || 20);

  const [total, tenants] = await Promise.all([
    Tenant.countDocuments(query),
    Tenant.find(query)
      .populate('ownerId', 'name email phone status')
      .populate('planId', 'name code price quotas features')
      .sort({ createdAt: -1 })
      .skip((numericPage - 1) * numericLimit)
      .limit(numericLimit),
  ]);

  return {
    tenants,
    pagination: {
      total,
      page: numericPage,
      limit: numericLimit,
      totalPages: Math.ceil(total / numericLimit),
    },
  };
};

/**
 * 3. Get Complete Tenant Details & Usage for Platform Admin
 */
export const getTenantAdminDetails = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId)
    .populate('ownerId', 'name email phone status createdAt')
    .populate('planId');

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const [usageData, ordersAgg] = await Promise.all([
    getTenantSubscriptionWithUsage(tenantId),
    Order.aggregate([
      { $match: { tenantId: tenant._id } },
      { $group: { _id: null, totalOrders: { $sum: 1 }, totalGmv: { $sum: '$financials.grandTotal' } } },
    ]),
  ]);

  return {
    tenant,
    subscription: usageData.subscription,
    plan: usageData.plan,
    usage: usageData.usage,
    financialOverview: {
      totalOrders: ordersAgg[0]?.totalOrders || 0,
      lifetimeGmv: ordersAgg[0]?.totalGmv || 0,
    },
  };
};

/**
 * 4. Suspend or Reactivate Tenant
 */
export const setTenantStatus = async (tenantId, status, { reason = '', actorId = null } = {}) => {
  const validStatuses = ['active', 'suspended', 'trial', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: [${validStatuses.join(', ')}]`);
  }

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    throw new Error('Tenant not found');
  }

  tenant.status = status;
  await tenant.save();

  // If suspended, also update subscription status if active
  if (status === 'suspended') {
    const sub = await Subscription.findOne({ tenantId });
    if (sub) {
      sub.history.push({
        action: 'tenant_suspended',
        date: new Date(),
        note: `Tenant suspended by platform admin: ${reason}`,
        actorId,
      });
      await sub.save();
    }
  }

  return tenant;
};

/**
 * Re-export plan management methods for admin controller
 */
export {
  createPlan,
  updatePlan,
  listPlans,
  assignPlanToTenant,
};
