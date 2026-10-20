import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDb, clearTestDb, closeTestDb } from '../setup.js';
import { createApp } from '../../src/app.js';
import { Product } from '../../src/modules/products/Product.js';
import { StockLedger } from '../../src/modules/inventory/StockLedger.js';
import { FinanceLedger } from '../../src/modules/finance/FinanceLedger.js';
import { User } from '../../src/modules/auth/User.js';

describe('Phase 2 — End-to-End System Lifecycle & Two-Tenant Isolation Proof', () => {
  let app;
  let tokenA, tokenB, adminToken;
  let tenantA, tenantB;
  let userA, userB, superAdminUser;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  }, 180000);

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Provision Test Tenant Alpha
    const resA = await request(app)
      .post('/api/v1/auth/register-tenant')
      .send({
        tenantName: 'Alpha Electronics',
        slug: 'alpha-store',
        subdomain: 'alpha',
        ownerName: 'Alpha Owner',
        email: 'owner@alpha.com',
        password: 'Password123!',
        phone: '03001111111',
      });

    expect(resA.status).toBe(201);
    expect(resA.body.success).toBe(true);
    tokenA = resA.body.data.token;
    tenantA = resA.body.data.tenant;
    userA = resA.body.data.user;

    // 2. Provision Test Tenant Beta (Completely isolated)
    const resB = await request(app)
      .post('/api/v1/auth/register-tenant')
      .send({
        tenantName: 'Beta Mart',
        slug: 'beta-mart',
        subdomain: 'beta',
        ownerName: 'Beta Owner',
        email: 'owner@beta.com',
        password: 'Password123!',
        phone: '03002222222',
      });

    expect(resB.status).toBe(201);
    expect(resB.body.success).toBe(true);
    tokenB = resB.body.data.token;
    tenantB = resB.body.data.tenant;
    userB = resB.body.data.user;

    // 3. Create Super-Admin user for platform-admin testing
    superAdminUser = await User.create({
      name: 'Root Platform Admin',
      email: 'superadmin@etimadsuit.com',
      password: 'AdminPassword123!',
      isPlatformAdmin: true,
      status: 'active',
    });

    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'superadmin@etimadsuit.com',
        password: 'AdminPassword123!',
      });

    expect(adminLoginRes.status).toBe(200);
    adminToken = adminLoginRes.body.data.token;
  });

  it('1. Product CRUD and strict two-tenant data isolation proof', async () => {
    // Tenant Alpha creates Product A
    const prodResA = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Alpha Noise Cancelling Earbuds',
        sku: 'ALPHA-EAR-01',
        category: 'Audio',
        pricing: {
          costPrice: 2000,
          retailPrice: 5000,
          websitePrice: 4800,
        },
        stock: 20,
      });

    expect(prodResA.status).toBe(201);
    const productA = prodResA.body.data;
    expect(productA.stock).toBe(20);
    expect(productA.tenantId.toString()).toBe(tenantA._id.toString());

    // Tenant Beta creates Product B
    const prodResB = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        name: 'Beta GaN Fast Charger 65W',
        sku: 'BETA-CHG-65W',
        category: 'Power',
        pricing: {
          costPrice: 1200,
          retailPrice: 3000,
        },
        stock: 50,
      });

    expect(prodResB.status).toBe(201);
    const productB = prodResB.body.data;

    // ISOLATION PROOF 1: Tenant Beta cannot fetch Product A
    const leakGet = await request(app)
      .get(`/api/v1/products/${productA._id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(leakGet.status).toBe(404);

    // ISOLATION PROOF 2: Tenant Beta cannot update Product A
    const leakUpdate = await request(app)
      .put(`/api/v1/products/${productA._id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Hacked by Beta' });
    expect(leakUpdate.status).toBe(404);

    // ISOLATION PROOF 3: Tenant Beta cannot delete Product A
    const leakDelete = await request(app)
      .delete(`/api/v1/products/${productA._id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(leakDelete.status).toBe(404);

    // ISOLATION PROOF 4: Tenant Beta catalog listing contains only Product B
    const listBeta = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(listBeta.body.data.length).toBe(1);
    expect(listBeta.body.data[0]._id.toString()).toBe(productB._id.toString());
  });

  it('2. Complete omnichannel flow: Online Order -> Retail POS Sale -> Shared Stock Ledger -> Finance Balance Sheet', async () => {
    // 1. Tenant Alpha creates product with 20 stock
    const prodRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Alpha Wireless Earbuds Pro',
        sku: 'EAR-PRO-01',
        category: 'Audio',
        pricing: { costPrice: 2000, retailPrice: 5000, websitePrice: 4800 },
        stock: 20,
      });

    const product = prodRes.body.data;
    expect(product.stock).toBe(20);

    // 2. Channel 1 (Online Storefront): Public customer orders 3 units
    const onlineOrderRes = await request(app)
      .post(`/api/v1/storefront/alpha-store/orders`)
      .send({
        customer: {
          name: 'Kamran Ali',
          phone: '03001234567',
          shippingAddress: { street: 'Main Mall Road', city: 'Lahore' },
        },
        items: [{ productId: product._id, quantity: 3 }],
        payment: { method: 'cod' },
      });

    expect(onlineOrderRes.status).toBe(201);
    expect(onlineOrderRes.body.success).toBe(true);
    const onlineOrder = onlineOrderRes.body.data;
    expect(onlineOrder.items[0].quantity).toBe(3);

    // Verify stock deducted from 20 to 17
    const productAfterOnline = await Product.findById(product._id);
    expect(productAfterOnline.stock).toBe(17);

    // Verify StockLedger has 1 entry of -3 units
    const ledgers1 = await StockLedger.find({ tenantId: tenantA._id, productId: product._id });
    expect(ledgers1.length).toBe(1);
    expect(ledgers1[0].delta).toBe(-3);
    expect(ledgers1[0].newStock).toBe(17);
    expect(ledgers1[0].type).toBe('SALE_DEDUCTION');

    // 3. Channel 2 (Retail POS): Cashier opens shift and completes retail sale for 2 units
    const shiftRes = await request(app)
      .post('/api/v1/pos/shifts/open')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ openingCash: 5000, registerId: 'POS-COUNTER-01' });

    expect(shiftRes.status).toBe(201);
    const shift = shiftRes.body.data;

    const posSaleRes = await request(app)
      .post('/api/v1/pos/sales')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        shiftId: shift._id,
        customer: { name: 'Walk-in Retail Buyer', phone: '03000000000' },
        items: [{ productId: product._id, quantity: 2 }],
        payment: {
          method: 'split',
          cashPaid: 5000,
          cardPaid: 5000,
        },
      });

    expect(posSaleRes.status).toBe(201);
    const posOrder = posSaleRes.body.data;
    expect(posOrder.channel).toBe('retail');

    // Verify shared stock is now 15 (20 - 3 online - 2 retail)
    const productAfterPos = await Product.findById(product._id);
    expect(productAfterPos.stock).toBe(15);

    // Verify StockLedger now has 2 entries total
    const ledgers2 = await StockLedger.find({ tenantId: tenantA._id, productId: product._id }).sort({ createdAt: 1 });
    expect(ledgers2.length).toBe(2);
    expect(ledgers2[1].delta).toBe(-2);
    expect(ledgers2[1].newStock).toBe(15);

    // PROVE TENANT ISOLATION: Tenant Beta has ZERO stock ledger movements
    const ledgersBeta = await StockLedger.find({ tenantId: tenantB._id });
    expect(ledgersBeta.length).toBe(0);

    // 4. Double-Entry Financial Accounting Verification
    const balanceSheetRes = await request(app)
      .get('/api/v1/finance/balance-sheet')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(balanceSheetRes.status).toBe(200);
    const bs = balanceSheetRes.body.data;

    // Assets = Liabilities + Equity invariant must be strictly balanced
    expect(bs.isBalanced).toBe(true);
    expect(bs.assets.totalAssets).toBe(bs.totalLiabilitiesAndEquity);

    // 5. Order Cancellation & Automatic Stock Restoration
    const cancelRes = await request(app)
      .patch(`/api/v1/orders/${onlineOrder._id}/status`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'cancelled',
        note: 'Customer requested cancellation before dispatch',
      });

    expect(cancelRes.status).toBe(200);

    // Verify stock restored from 15 back to 18
    const productAfterCancel = await Product.findById(product._id);
    expect(productAfterCancel.stock).toBe(18);

    // Verify StockLedger recorded STOCK_RELEASE of +3
    const releaseLedger = await StockLedger.findOne({
      tenantId: tenantA._id,
      productId: product._id,
      type: 'STOCK_RELEASE',
    });
    expect(releaseLedger).not.toBeNull();
    expect(releaseLedger.delta).toBe(3);
    expect(releaseLedger.newStock).toBe(18);
  });

  it('3. Concurrency & Overselling Protection under race condition', async () => {
    // Product with stock = 15
    const prod = await Product.create({
      tenantId: tenantA._id,
      name: 'Limited Edition Smart Watch',
      slug: 'limited-watch',
      sku: 'LTD-WCH',
      pricing: { retailPrice: 10000, websitePrice: 10000, costPrice: 4000 },
      stock: 15,
      isOnlineAvailable: true,
    });

    // 5 simultaneous requests attempting to buy 10 units each (Total 50 requested, only 15 exist)
    const orderPromises = Array.from({ length: 5 }).map((_, i) =>
      request(app)
        .post('/api/v1/storefront/alpha-store/orders')
        .send({
          customer: { name: `Buyer ${i}`, phone: `0300111222${i}`, shippingAddress: { city: 'Islamabad' } },
          items: [{ productId: prod._id, quantity: 10 }],
          payment: { method: 'cod' },
        })
    );

    const results = await Promise.all(orderPromises);

    const successful = results.filter((r) => r.status === 201);
    const failed = results.filter((r) => r.status === 400);

    // Exactly 1 request can succeed (10 units deducted), the rest 4 must fail
    expect(successful.length).toBe(1);
    expect(failed.length).toBe(4);

    // Verify final stock is exactly 5 (15 - 10), never negative
    const finalProd = await Product.findById(prod._id);
    expect(finalProd.stock).toBe(5);
  });

  it('4. Platform Admin RBAC security and telemetry enforcement', async () => {
    // 1. Tenant Alpha user attempts to access Platform Admin telemetry -> Must be 403 FORBIDDEN
    const forbiddenRes = await request(app)
      .get('/api/v1/platform-admin/metrics')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body.error.code).toBe('FORBIDDEN');

    // 2. Real Platform Super-Admin accesses metrics -> Must be 200 OK
    const adminMetricsRes = await request(app)
      .get('/api/v1/platform-admin/metrics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(adminMetricsRes.status).toBe(200);
    expect(adminMetricsRes.body.success).toBe(true);
    expect(adminMetricsRes.body.data.tenants).toBeDefined();

    // 3. Platform Admin inspects tenant directory
    const tenantsListRes = await request(app)
      .get('/api/v1/platform-admin/tenants')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(tenantsListRes.status).toBe(200);
    expect(tenantsListRes.body.data.length).toBeGreaterThanOrEqual(2);

    // 4. Platform Admin suspends Tenant Beta
    const suspendRes = await request(app)
      .patch(`/api/v1/platform-admin/tenants/${tenantB._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'suspended', reason: 'Billing policy compliance review' });

    expect(suspendRes.status).toBe(200);

    // 5. Tenant Beta user attempts to make API calls while suspended -> Must be 403 TENANT_INACTIVE
    const blockedBetaRes = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(blockedBetaRes.status).toBe(403);
    expect(blockedBetaRes.body.error.code).toBe('TENANT_INACTIVE');
  });
});
