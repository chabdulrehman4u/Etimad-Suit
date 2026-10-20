import {
  getPlatformOverviewMetrics,
  listAllTenants,
  getTenantAdminDetails,
  setTenantStatus,
  createPlan,
  updatePlan,
  listPlans,
  assignPlanToTenant,
} from './platformAdminService.js';
import { Plan } from '../subscriptions/Plan.js';

/**
 * 1. Platform-wide metrics
 */
export const getPlatformMetrics = async (req, res) => {
  try {
    const metrics = await getPlatformOverviewMetrics();
    return res.json({
      success: true,
      data: metrics,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'METRICS_FAILED', message: err.message },
    });
  }
};

/**
 * 2. List all platform tenants
 */
export const listTenants = async (req, res) => {
  try {
    const { search, status, page, limit } = req.query;
    const result = await listAllTenants({ search, status, page, limit });
    return res.json({
      success: true,
      data: result.tenants,
      pagination: result.pagination,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'LIST_TENANTS_FAILED', message: err.message },
    });
  }
};

/**
 * 3. Get single tenant details & usage for platform admin
 */
export const getTenantDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const details = await getTenantAdminDetails(id);
    return res.json({
      success: true,
      data: details,
    });
  } catch (err) {
    return res.status(404).json({
      success: false,
      error: { code: 'TENANT_NOT_FOUND', message: err.message },
    });
  }
};

/**
 * 4. Suspend or reactivate tenant
 */
export const updateTenantStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_STATUS', message: 'status is required.' },
      });
    }

    const tenant = await setTenantStatus(id, status, {
      reason,
      actorId: req.user._id,
    });

    return res.json({
      success: true,
      message: `Tenant status successfully updated to '${status}'.`,
      data: tenant,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'UPDATE_STATUS_FAILED', message: err.message },
    });
  }
};

/**
 * 5. Change tenant plan (Platform Admin manual upgrade/downgrade)
 */
export const changeTenantPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { planId, billingCycle = 'monthly', status = 'active' } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PLAN_ID', message: 'planId is required.' },
      });
    }

    const result = await assignPlanToTenant({
      tenantId: id,
      planId,
      billingCycle,
      status,
      actorId: req.user._id,
      paymentMethod: 'admin_override',
    });

    return res.json({
      success: true,
      message: `Successfully updated tenant plan to ${result.plan.name}.`,
      data: result,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'CHANGE_PLAN_FAILED', message: err.message },
    });
  }
};

/**
 * 6. Create new SaaS plan
 */
export const createNewPlan = async (req, res) => {
  try {
    const plan = await createPlan(req.body);
    return res.status(201).json({
      success: true,
      message: `Plan '${plan.name}' created successfully.`,
      data: plan,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'CREATE_PLAN_FAILED', message: err.message },
    });
  }
};

/**
 * 7. Update SaaS plan
 */
export const updateExistingPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await updatePlan(id, req.body);
    return res.json({
      success: true,
      message: `Plan '${plan.name}' updated successfully.`,
      data: plan,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'UPDATE_PLAN_FAILED', message: err.message },
    });
  }
};

/**
 * 8. List all plans (including inactive)
 */
export const listAllPlans = async (req, res) => {
  try {
    const plans = await listPlans({ includeInactive: true });
    return res.json({
      success: true,
      data: plans,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'LIST_PLANS_FAILED', message: err.message },
    });
  }
};

/**
 * 9. Archive SaaS plan
 */
export const archivePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await Plan.findById(id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: { code: 'PLAN_NOT_FOUND', message: 'Plan not found.' },
      });
    }

    plan.isActive = false;
    await plan.save();

    return res.json({
      success: true,
      message: `Plan '${plan.name}' archived successfully.`,
      data: plan,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'ARCHIVE_PLAN_FAILED', message: err.message },
    });
  }
};

