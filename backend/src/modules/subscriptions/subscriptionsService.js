import mongoose from 'mongoose';
import { Plan } from './Plan.js';
import { Subscription } from './Subscription.js';
import { Tenant } from '../tenants/Tenant.js';
import { Product } from '../products/Product.js';
import { TenantMembership } from '../tenants/TenantMembership.js';
import { Order } from '../orders/Order.js';

/**
 * 1. Get or seed default Starter Plan
 */
export const getDefaultPlan = async () => {
  let plan = await Plan.findOne({ code: 'starter' });
  if (!plan) {
    plan = new Plan({
      name: 'Starter',
      code: 'starter',
      description: 'Ideal for new sellers launching their online & retail business',
      price: {
        monthly: 2999,
        yearly: 29990,
        currency: 'PKR',
      },
      quotas: {
        maxProducts: 100,
        maxStaff: 3,
        maxOrdersPerMonth: 500,
        maxWarehouses: 1,
      },
      features: {
        customDomainAllowed: false,
        appsAccessAllowed: true,
        posAllowed: true,
        wholesaleAllowed: true,
        analyticsAdvanced: false,
        prioritySupport: false,
      },
      isActive: true,
      isPublic: true,
      trialDays: 14,
    });
    await plan.save();
  }
  return plan;
};

/**
 * 2. Create New SaaS Plan (Platform Admin)
 */
export const createPlan = async (planData) => {
  const existing = await Plan.findOne({ code: planData.code.toLowerCase().trim() });
  if (existing) {
    throw new Error(`Plan with code '${planData.code}' already exists`);
  }

  const plan = new Plan({
    ...planData,
    code: planData.code.toLowerCase().trim(),
  });
  await plan.save();
  return plan;
};

/**
 * 3. Update Existing Plan (Platform Admin)
 */
export const updatePlan = async (planId, updates) => {
  const plan = await Plan.findById(planId);
  if (!plan) {
    throw new Error('Plan not found');
  }

  if (updates.name) plan.name = updates.name;
  if (updates.description !== undefined) plan.description = updates.description;
  if (updates.price) plan.price = { ...plan.price.toObject(), ...updates.price };
  if (updates.quotas) plan.quotas = { ...plan.quotas.toObject(), ...updates.quotas };
  if (updates.features) plan.features = { ...plan.features.toObject(), ...updates.features };
  if (updates.isActive !== undefined) plan.isActive = updates.isActive;
  if (updates.isPublic !== undefined) plan.isPublic = updates.isPublic;
  if (updates.trialDays !== undefined) plan.trialDays = updates.trialDays;

  await plan.save();
  return plan;
};

/**
 * 4. List Plans
 */
export const listPlans = async ({ includeInactive = false } = {}) => {
  const query = includeInactive ? {} : { isActive: true };
  return Plan.find(query).sort({ 'price.monthly': 1 });
};

/**
 * 5. Assign or Change Tenant Plan
 */
export const assignPlanToTenant = async ({
  tenantId,
  planId,
  billingCycle = 'monthly',
  status = 'active',
  actorId = null,
  paymentMethod = 'manual',
}) => {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const plan = await Plan.findById(planId);
  if (!plan) {
    throw new Error('Plan not found');
  }

  const now = new Date();
  const periodEnd = new Date(now);
  if (billingCycle === 'yearly') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setDate(periodEnd.getDate() + 30);
  }

  const amount = billingCycle === 'yearly' ? plan.price.yearly : plan.price.monthly;

  let subscription = await Subscription.findOne({ tenantId });
  if (subscription) {
    subscription.planId = plan._id;
    subscription.billingCycle = billingCycle;
    subscription.amount = amount;
    subscription.currency = plan.price.currency || 'PKR';
    subscription.status = status;
    subscription.currentPeriodStart = now;
    subscription.currentPeriodEnd = periodEnd;
    subscription.cancelAtPeriodEnd = false;
    subscription.paymentMethod = paymentMethod;
    subscription.history.push({
      action: 'plan_change',
      date: now,
      note: `Updated to ${plan.name} (${billingCycle})`,
      actorId,
    });
    await subscription.save();
  } else {
    subscription = new Subscription({
      tenantId,
      planId: plan._id,
      status,
      billingCycle,
      amount,
      currency: plan.price.currency || 'PKR',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      paymentMethod,
      history: [
        {
          action: 'subscription_created',
          date: now,
          note: `Subscribed to ${plan.name} (${billingCycle})`,
          actorId,
        },
      ],
    });
    await subscription.save();
  }

  tenant.planId = plan._id;
  await tenant.save();

  return { tenant, subscription, plan };
};

/**
 * 6. Get Tenant Subscription with Real-time Usage Metrics
 */
export const getTenantSubscriptionWithUsage = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    throw new Error('Tenant not found');
  }

  let subscription = await Subscription.findOne({ tenantId }).populate('planId');
  let plan = subscription?.planId;

  if (!plan) {
    if (tenant.planId) {
      plan = await Plan.findById(tenant.planId);
    }
    if (!plan) {
      plan = await getDefaultPlan();
    }

    // Auto-create trial subscription if none exists
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + (plan.trialDays || 14));

    subscription = new Subscription({
      tenantId,
      planId: plan._id,
      status: 'trialing',
      billingCycle: 'monthly',
      amount: plan.price.monthly,
      currency: plan.price.currency || 'PKR',
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
      trialStart: now,
      trialEnd,
      history: [
        {
          action: 'trial_started',
          date: now,
          note: `Started ${plan.trialDays}-day trial of ${plan.name}`,
        },
      ],
    });
    await subscription.save();
    tenant.planId = plan._id;
    await tenant.save();
  }

  // Calculate real-time consumption metrics
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [productCount, staffCount, ordersThisMonth] = await Promise.all([
    Product.countDocuments({ tenantId }),
    TenantMembership.countDocuments({ tenantId, status: 'active' }),
    Order.countDocuments({ tenantId, createdAt: { $gte: startOfMonth } }),
  ]);

  const quotas = plan.quotas || {};
  const maxProducts = quotas.maxProducts ?? 100;
  const maxStaff = quotas.maxStaff ?? 3;
  const maxOrders = quotas.maxOrdersPerMonth ?? 500;

  const usage = {
    products: {
      used: productCount,
      limit: maxProducts,
      unlimited: maxProducts === -1,
      percentage: maxProducts > 0 ? Math.min(100, Math.round((productCount / maxProducts) * 100)) : 0,
      remaining: maxProducts === -1 ? Infinity : Math.max(0, maxProducts - productCount),
    },
    staff: {
      used: staffCount,
      limit: maxStaff,
      unlimited: maxStaff === -1,
      percentage: maxStaff > 0 ? Math.min(100, Math.round((staffCount / maxStaff) * 100)) : 0,
      remaining: maxStaff === -1 ? Infinity : Math.max(0, maxStaff - staffCount),
    },
    orders: {
      used: ordersThisMonth,
      limit: maxOrders,
      unlimited: maxOrders === -1,
      percentage: maxOrders > 0 ? Math.min(100, Math.round((ordersThisMonth / maxOrders) * 100)) : 0,
      remaining: maxOrders === -1 ? Infinity : Math.max(0, maxOrders - ordersThisMonth),
    },
  };

  return {
    tenant: {
      _id: tenant._id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
    },
    subscription,
    plan,
    usage,
  };
};

/**
 * 7. Cancel Subscription
 */
export const cancelSubscription = async ({ tenantId, actorId, immediate = false }) => {
  const subscription = await Subscription.findOne({ tenantId });
  if (!subscription) {
    throw new Error('No active subscription found');
  }

  const now = new Date();
  if (immediate) {
    subscription.status = 'canceled';
    subscription.cancelAtPeriodEnd = false;
    subscription.history.push({
      action: 'canceled_immediate',
      date: now,
      note: 'Subscription canceled immediately',
      actorId,
    });
  } else {
    subscription.cancelAtPeriodEnd = true;
    subscription.history.push({
      action: 'cancel_scheduled',
      date: now,
      note: 'Subscription scheduled to cancel at end of current period',
      actorId,
    });
  }

  await subscription.save();
  return subscription;
};
