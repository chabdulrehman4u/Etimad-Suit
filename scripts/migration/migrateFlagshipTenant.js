import { Tenant } from '../../backend/src/modules/tenants/Tenant.js';
import { Plan } from '../../backend/src/modules/subscriptions/Plan.js';
import { Subscription } from '../../backend/src/modules/subscriptions/Subscription.js';
import { User } from '../../backend/src/modules/auth/User.js';

/**
 * Phase B: Provision or Reconcile Flagship Tenant
 * Provisions 'Etimad Mart (Flagship)' with verified domain 'etimadmart.com'
 * and unlimited Enterprise SaaS plan.
 */
export const migrateFlagshipTenant = async ({ ownerUserId = null } = {}) => {
  // 1. Ensure or find Enterprise Plan for Flagship
  let plan = await Plan.findOne({ code: 'enterprise' });
  if (!plan) {
    plan = new Plan({
      name: 'Enterprise Flagship',
      code: 'enterprise',
      description: 'Unlimited SaaS tier for platform flagship and large multi-store retailers',
      price: {
        monthly: 14999,
        yearly: 149990,
        currency: 'PKR',
      },
      quotas: {
        maxProducts: -1, // Unlimited
        maxStaff: -1,
        maxOrdersPerMonth: -1,
        maxWarehouses: 10,
      },
      features: {
        customDomainAllowed: true,
        appsAccessAllowed: true,
        posAllowed: true,
        wholesaleAllowed: true,
        analyticsAdvanced: true,
        prioritySupport: true,
      },
      isActive: true,
      isPublic: false,
    });
    await plan.save();
  }

  // 2. Resolve or provision Flagship Owner User
  let owner = null;
  if (ownerUserId) {
    owner = await User.findById(ownerUserId);
  }
  if (!owner) {
    owner = await User.findOne({ email: 'admin@etimadmart.com' });
  }
  if (!owner) {
    owner = new User({
      name: 'Etimad Mart Owner',
      email: 'admin@etimadmart.com',
      password: 'TemporaryMigratedPassword2026!',
      phone: '03001234567',
      isPlatformAdmin: true,
      status: 'active',
    });
    await owner.save();
  }

  // 3. Find or Create Flagship Tenant
  let tenant = await Tenant.findOne({ slug: 'etimadmart' });
  if (!tenant) {
    tenant = new Tenant({
      name: 'Etimad Mart (Flagship)',
      slug: 'etimadmart',
      subdomain: 'etimadmart',
      status: 'active',
      ownerId: owner._id,
      planId: plan._id,
      customDomains: [
        {
          domain: 'etimadmart.com',
          isVerified: true,
          verificationToken: 'etimad-flagship-verified-2026',
          verifiedAt: new Date(),
          isPrimary: true,
        },
      ],
      settings: {
        currency: 'PKR',
        currencySymbol: 'Rs.',
        timezone: 'Asia/Karachi',
        contactPhone: '03001234567',
        contactEmail: 'support@etimadmart.com',
        primaryColor: '#0284c7',
        secondaryColor: '#0f172a',
      },
    });
    await tenant.save();
  } else {
    // Reconcile flagship settings
    tenant.planId = plan._id;
    tenant.status = 'active';
    const hasCustomDomain = tenant.customDomains.some((d) => d.domain === 'etimadmart.com');
    if (!hasCustomDomain) {
      tenant.customDomains.push({
        domain: 'etimadmart.com',
        isVerified: true,
        verificationToken: 'etimad-flagship-verified-2026',
        verifiedAt: new Date(),
        isPrimary: true,
      });
    }
    await tenant.save();
  }

  // 4. Create or Update Active Flagship Subscription
  let subscription = await Subscription.findOne({ tenantId: tenant._id });
  const now = new Date();
  const nextYear = new Date(now);
  nextYear.setFullYear(nextYear.getFullYear() + 5); // 5-year flagship grant

  if (!subscription) {
    subscription = new Subscription({
      tenantId: tenant._id,
      planId: plan._id,
      status: 'active',
      billingCycle: 'yearly',
      amount: plan.price.yearly,
      currency: 'PKR',
      currentPeriodStart: now,
      currentPeriodEnd: nextYear,
      paymentMethod: 'system_grant',
      paymentStatus: 'paid',
      history: [
        {
          action: 'flagship_provisioned',
          date: now,
          note: 'Flagship enterprise lifetime subscription provisioned during migration',
        },
      ],
    });
    await subscription.save();
  }

  return { tenant, plan, owner, subscription };
};

