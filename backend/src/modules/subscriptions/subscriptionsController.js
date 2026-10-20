import {
  getTenantSubscriptionWithUsage,
  listPlans,
  assignPlanToTenant,
  cancelSubscription,
} from './subscriptionsService.js';

/**
 * 1. Get current tenant subscription and real-time quota usage
 */
export const getCurrentSubscription = async (req, res) => {
  try {
    const result = await getTenantSubscriptionWithUsage(req.tenantId);
    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'SUBSCRIPTION_FETCH_FAILED', message: err.message },
    });
  }
};

/**
 * 2. List public plans available for subscription/upgrade
 */
export const getPublicPlans = async (req, res) => {
  try {
    const plans = await listPlans({ includeInactive: false });
    return res.json({
      success: true,
      data: plans,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'PLANS_FETCH_FAILED', message: err.message },
    });
  }
};

/**
 * 3. Merchant Self-Serve Plan Upgrade / Change
 */
export const upgradeTenantPlan = async (req, res) => {
  try {
    const { planId, billingCycle = 'monthly', paymentMethod = 'manual' } = req.body;
    if (!planId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PLAN_ID', message: 'planId is required for upgrade.' },
      });
    }

    const result = await assignPlanToTenant({
      tenantId: req.tenantId,
      planId,
      billingCycle,
      actorId: req.user._id,
      paymentMethod,
    });

    return res.json({
      success: true,
      message: `Successfully upgraded to ${result.plan.name} (${billingCycle})!`,
      data: result,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'UPGRADE_FAILED', message: err.message },
    });
  }
};

/**
 * 4. Cancel Current Subscription
 */
export const cancelCurrentSubscription = async (req, res) => {
  try {
    const { immediate = false } = req.body;
    const subscription = await cancelSubscription({
      tenantId: req.tenantId,
      actorId: req.user._id,
      immediate,
    });

    return res.json({
      success: true,
      message: immediate
        ? 'Subscription canceled immediately.'
        : 'Subscription scheduled to cancel at the end of the billing period.',
      data: subscription,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'CANCEL_FAILED', message: err.message },
    });
  }
};

