import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDb, clearTestDb, closeTestDb } from '../setup.js';
import { createApp } from '../../src/app.js';
import { User } from '../../src/modules/auth/User.js';
import { Plan } from '../../src/modules/subscriptions/Plan.js';
import { Product } from '../../src/modules/products/Product.js';
import { generateToken } from '../../src/modules/auth/authController.js';

describe('Phase 8: Subscriptions, Plans & Platform Administration Suite', () => {
  let app;
  let superAdminUser, superAdminToken;
  let sellerToken, sellerUser, sellerTenant;
  let starterPlan, proPlan, enterprisePlan;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  }, 180000);

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Create Platform Super Admin
    superAdminUser = new User({
      name: 'Platform Super Admin',
      email: 'admin@etimadsuit.com',
      password: 'SuperAdminPassword123!',
      isPlatformAdmin: true,
      status: 'active',
    });
    await superAdminUser.save();

    superAdminToken = generateToken({
      userId: superAdminUser._id,
      isPlatformAdmin: true,
    });

    // 2. Register standard Seller Merchant
    const regRes = await request(app)
      .post('/api/v1/auth/register-tenant')
      .send({
        tenantName: 'Alpha Electronics',
        slug: 'alpha-electronics',
        subdomain: 'alpha',
        ownerName: 'Rashid Khan',
        email: 'rashid@alpha.pk',
        password: 'Password123!',
        phone: '03001234567',
      });

    expect(regRes.status).toBe(201);
    sellerToken = regRes.body.data.token;
    sellerUser = regRes.body.data.user;
    sellerTenant = regRes.body.data.tenant;
  });

  it('1. Platform Admin configures tiered SaaS plans and guards endpoints from unauthorized users', async () => {
    // Regular seller attempts to access admin metrics -> 403 Forbidden
    const unauthMetricsRes = await request(app)
      .get('/api/v1/platform-admin/metrics')
      .set('Authorization', `Bearer ${sellerToken}`);

    expect(unauthMetricsRes.status).toBe(403);
    expect(unauthMetricsRes.body.error.code).toBe('FORBIDDEN');

    // Platform admin creates Starter Plan with strict product & staff limits
    const starterRes = await request(app)
      .post('/api/v1/platform-admin/plans')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'Starter Plan',
        code: 'starter-tier',
        description: 'For micro-merchants just getting started',
        price: { monthly: 1999, yearly: 19990, currency: 'PKR' },
        quotas: {
          maxProducts: 2,
          maxStaff: 1,
          maxOrdersPerMonth: 50,
          maxWarehouses: 1,
        },
        features: {
          customDomainAllowed: false,
          appsAccessAllowed: false,
          posAllowed: true,
          wholesaleAllowed: false,
          analyticsAdvanced: false,
          prioritySupport: false,
        },
      });

    expect(starterRes.status).toBe(201);
    starterPlan = starterRes.body.data;
    expect(starterPlan.code).toBe('starter-tier');

    // Platform admin creates Pro Plan with generous limits and unlocked features
    const proRes = await request(app)
      .post('/api/v1/platform-admin/plans')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'Pro Merchant Plan',
        code: 'pro-tier',
        description: 'For growing businesses requiring courier apps and custom branding',
        price: { monthly: 5999, yearly: 59990, currency: 'PKR' },
        quotas: {
          maxProducts: 500,
          maxStaff: 10,
          maxOrdersPerMonth: 2000,
          maxWarehouses: 5,
        },
        features: {
          customDomainAllowed: true,
          appsAccessAllowed: true,
          posAllowed: true,
          wholesaleAllowed: true,
          analyticsAdvanced: true,
          prioritySupport: true,
        },
      });

    expect(proRes.status).toBe(201);
    proPlan = proRes.body.data;
    expect(proPlan.features.customDomainAllowed).toBe(true);
    expect(proPlan.features.appsAccessAllowed).toBe(true);

    // List all plans as platform admin
    const listPlansRes = await request(app)
      .get('/api/v1/platform-admin/plans')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(listPlansRes.status).toBe(200);
    expect(listPlansRes.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('2. Enforces resource quota limits (HTTP 402 QUOTA_EXCEEDED) when products exceed plan limit', async () => {
    // 1. Create Starter Plan with limit = 2
    const plan = new Plan({
      name: 'Micro Starter',
      code: 'micro-starter',
      price: { monthly: 999, yearly: 9990, currency: 'PKR' },
      quotas: { maxProducts: 2, maxStaff: 1 },
      features: { customDomainAllowed: false, appsAccessAllowed: false },
    });
    await plan.save();

    // Assign plan to seller
    await request(app)
      .post(`/api/v1/platform-admin/tenants/${sellerTenant._id}/plan`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ planId: plan._id });

    // 2. Query usage baseline
    const usageRes = await request(app)
      .get('/api/v1/subscriptions/current')
      .set('Authorization', `Bearer ${sellerToken}`);

    expect(usageRes.status).toBe(200);
    expect(usageRes.body.data.usage.products.used).toBe(0);
    expect(usageRes.body.data.usage.products.limit).toBe(2);

    // 3. Create Product 1 (succeeds)
    const prod1Res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        name: 'Wireless Earbuds',
        sku: 'EAR-001',
        pricing: {
          costPrice: 1500,
          retailPrice: 2800,
        },
      });
    expect(prod1Res.status).toBe(201);

    // 4. Create Product 2 (succeeds, reaching limit of 2)
    const prod2Res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        name: 'Smart Watch Series 7',
        sku: 'WAT-002',
        pricing: {
          costPrice: 4000,
          retailPrice: 6500,
        },
      });
    expect(prod2Res.status).toBe(201);

    // 5. Attempt to create Product 3 (exceeds limit 2 -> 402 Payment Required)
    const prod3Res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        name: 'Bluetooth Speaker',
        sku: 'SPK-003',
        pricing: {
          costPrice: 2000,
          retailPrice: 3500,
        },
      });

    expect(prod3Res.status).toBe(402);
    expect(prod3Res.body.error.code).toBe('QUOTA_EXCEEDED');
    expect(prod3Res.body.error.currentUsage).toBe(2);
    expect(prod3Res.body.error.limit).toBe(2);

    // Verify DB count remains exactly 2
    const totalCount = await Product.countDocuments({ tenantId: sellerTenant._id });
    expect(totalCount).toBe(2);
  });

  it('3. Enforces feature gates (HTTP 403 FEATURE_NOT_ENTITLED) for custom domains and apps access', async () => {
    // 1. Create Starter plan without custom domains or apps
    const plan = new Plan({
      name: 'Basic No-Apps Plan',
      code: 'basic-no-apps',
      price: { monthly: 999, yearly: 9990, currency: 'PKR' },
      quotas: { maxProducts: 100, maxStaff: 5 },
      features: { customDomainAllowed: false, appsAccessAllowed: false },
    });
    await plan.save();

    await request(app)
      .post(`/api/v1/platform-admin/tenants/${sellerTenant._id}/plan`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ planId: plan._id });

    // 2. Attempt to add custom domain -> 403 FEATURE_NOT_ENTITLED
    const domainRes = await request(app)
      .post('/api/v1/tenants/domains')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ domain: 'alphaelectronics.pk' });

    expect(domainRes.status).toBe(403);
    expect(domainRes.body.error.code).toBe('FEATURE_NOT_ENTITLED');
    expect(domainRes.body.error.requiredFeature).toBe('customDomainAllowed');

    // 3. Attempt to save courier connection -> 403 FEATURE_NOT_ENTITLED
    const appRes = await request(app)
      .post('/api/v1/apps/connections')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        providerId: 'lcs',
        credentials: { apiKey: 'key123', apiPassword: 'pwd', accountCode: 'ACC1' },
      });

    expect(appRes.status).toBe(403);
    expect(appRes.body.error.code).toBe('FEATURE_NOT_ENTITLED');
    expect(appRes.body.error.requiredFeature).toBe('appsAccessAllowed');
  });

  it('4. Merchant upgrades plan self-serve, instantly unlocking quotas and gated features', async () => {
    // 1. Create Starter and Pro plans
    const starter = new Plan({
      name: 'Starter Plan',
      code: 'starter-auto',
      price: { monthly: 1500, yearly: 15000, currency: 'PKR' },
      quotas: { maxProducts: 1, maxStaff: 1 },
      features: { customDomainAllowed: false, appsAccessAllowed: false },
    });
    await starter.save();

    const pro = new Plan({
      name: 'Pro Plan',
      code: 'pro-auto',
      price: { monthly: 4500, yearly: 45000, currency: 'PKR' },
      quotas: { maxProducts: 500, maxStaff: 10 },
      features: { customDomainAllowed: true, appsAccessAllowed: true },
    });
    await pro.save();

    // Assign starter to seller
    await request(app)
      .post(`/api/v1/platform-admin/tenants/${sellerTenant._id}/plan`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ planId: starter._id });

    // Fill the 1 product quota
    await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        name: 'Product A',
        sku: 'SKU-A',
        pricing: { costPrice: 500, retailPrice: 1000 },
      });

    // Adding 2nd product fails
    const blockedRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        name: 'Product B',
        sku: 'SKU-B',
        pricing: { costPrice: 500, retailPrice: 1000 },
      });
    expect(blockedRes.status).toBe(402);

    // 2. Merchant upgrades to Pro plan self-serve
    const upgradeRes = await request(app)
      .post('/api/v1/subscriptions/upgrade')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ planId: pro._id, billingCycle: 'yearly' });

    expect(upgradeRes.status).toBe(200);
    expect(upgradeRes.body.data.plan.name).toBe('Pro Plan');
    expect(upgradeRes.body.data.subscription.billingCycle).toBe('yearly');

    // 3. Product creation now succeeds (quota unlocked to 500)
    const successRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        name: 'Product B',
        sku: 'SKU-B',
        pricing: { costPrice: 500, retailPrice: 1000 },
      });
    expect(successRes.status).toBe(201);

    // 4. Custom domain addition now succeeds
    const domainRes = await request(app)
      .post('/api/v1/tenants/domains')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ domain: 'store.alphapk.com' });
    expect(domainRes.status).toBe(201);

    // 5. Custom domain verification endpoint succeeds
    const verifyRes = await request(app)
      .post('/api/v1/tenants/domains/store.alphapk.com/verify')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.isVerified).toBe(true);

    // 6. Courier app connection now succeeds
    const appRes = await request(app)
      .post('/api/v1/apps/connections')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        providerId: 'lcs',
        credentials: { apiKey: 'live-key-99', apiPassword: 'live-password', accountCode: 'ACC-88' },
      });
    expect(appRes.status).toBe(201);
    expect(appRes.body.data.providerId).toBe('lcs');
  });

  it('5. Platform admin suspends tenant, blocking mutating requests, and reactivates seamlessly', async () => {
    // 1. Platform admin inspects tenant details
    const detailsRes = await request(app)
      .get(`/api/v1/platform-admin/tenants/${sellerTenant._id}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(detailsRes.status).toBe(200);
    expect(detailsRes.body.data.tenant.slug).toBe('alpha-electronics');
    expect(detailsRes.body.data.usage).toBeDefined();

    // 2. Platform admin suspends tenant for policy violation
    const suspendRes = await request(app)
      .patch(`/api/v1/platform-admin/tenants/${sellerTenant._id}/status`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'suspended', reason: 'Billing delinquency' });

    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.data.status).toBe('suspended');

    // 3. Suspended seller attempts to list or create products -> 403 TENANT_INACTIVE
    const attemptRes = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${sellerToken}`);

    expect(attemptRes.status).toBe(403);
    expect(attemptRes.body.error.code).toBe('TENANT_INACTIVE');

    // 4. Platform admin reactivates tenant
    const reactivateRes = await request(app)
      .patch(`/api/v1/platform-admin/tenants/${sellerTenant._id}/status`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'active', reason: 'Payment cleared' });

    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.data.status).toBe('active');

    // 5. Merchant can resume operations
    const resumedRes = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${sellerToken}`);

    expect(resumedRes.status).toBe(200);
  });

  it('6. Calculates authoritative platform metrics and Monthly Recurring Revenue (MRR)', async () => {
    // Query platform overview metrics
    const metricsRes = await request(app)
      .get('/api/v1/platform-admin/metrics')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(metricsRes.status).toBe(200);
    const data = metricsRes.body.data;

    expect(data.tenants.total).toBeGreaterThanOrEqual(1);
    expect(data.users.total).toBeGreaterThanOrEqual(2); // Super admin + seller
    expect(data.orders.total).toBeDefined();
    expect(data.subscriptions.monthlyRecurringRevenue).toBeGreaterThanOrEqual(0);
  });
});
