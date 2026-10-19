import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDb, clearTestDb, closeTestDb } from '../setup.js';
import { createApp } from '../../src/app.js';
import { Product } from '../../src/modules/products/Product.js';
import { Tenant } from '../../src/modules/tenants/Tenant.js';
import { ROLES, PERMISSIONS } from '../../src/modules/auth/roles.js';

describe('Multi-Tenant Isolation & Security Suite', () => {
  let app;
  let sellerAToken, sellerBToken;
  let tenantA, tenantB;
  let userA, userB;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  }, 180000); // 180s timeout for initial mongodb-memory-server binary download if needed

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Register Seller A
    const resA = await request(app)
      .post('/api/v1/auth/register-tenant')
      .send({
        tenantName: 'Apex Electronics',
        slug: 'apex-electronics',
        subdomain: 'apex',
        ownerName: 'Ali Khan',
        email: 'ali@apex.com',
        password: 'Password123!',
        phone: '03001234567',
      });

    expect(resA.status).toBe(201);
    expect(resA.body.success).toBe(true);
    sellerAToken = resA.body.data.token;
    tenantA = resA.body.data.tenant;
    userA = resA.body.data.user;

    // 2. Register Seller B (Independent Merchant)
    const resB = await request(app)
      .post('/api/v1/auth/register-tenant')
      .send({
        tenantName: 'Boutique Elegance',
        slug: 'boutique-elegance',
        subdomain: 'boutique',
        ownerName: 'Sara Ahmed',
        email: 'sara@boutique.com',
        password: 'Password123!',
        phone: '03007654321',
      });

    expect(resB.status).toBe(201);
    expect(resB.body.success).toBe(true);
    sellerBToken = resB.body.data.token;
    tenantB = resB.body.data.tenant;
    userB = resB.body.data.user;

    expect(tenantA._id).not.toBe(tenantB._id);
  });

  // TEST 1: Tenant-Scoped Catalog Creation
  it('1. Allows Seller A to create a product scoped to their tenant', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        name: 'Vintage Trimmer Pro',
        sku: 'VINT-T9',
        barcode: '9988776655',
        pricing: {
          costPrice: 1200,
          retailPrice: 2499,
          websitePrice: 2299,
        },
        stock: 50,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Vintage Trimmer Pro');
    expect(res.body.data.tenantId).toBe(tenantA._id);

    // Verify in database
    const dbProduct = await Product.findById(res.body.data._id);
    expect(dbProduct).toBeDefined();
    expect(String(dbProduct.tenantId)).toBe(String(tenantA._id));
  });

  // TEST 2: Tenant-Scoped Compound Uniqueness (Same SKU / Barcode in different tenants)
  it('2. Permits identical SKU and Barcode across different tenants without collision', async () => {
    // Seller A creates product with SKU 'UNIVERSAL-01' and barcode '111222333'
    const resA = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        name: 'Apex Shaver',
        sku: 'UNIVERSAL-01',
        barcode: '111222333',
        pricing: { retailPrice: 1500 },
        stock: 20,
      });
    expect(resA.status).toBe(201);

    // Seller B creates product with the EXACT SAME SKU and Barcode
    const resB = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${sellerBToken}`)
      .send({
        name: 'Boutique Shaver',
        sku: 'UNIVERSAL-01',
        barcode: '111222333',
        pricing: { retailPrice: 1800 },
        stock: 10,
      });

    // Should succeed because compound unique indexes are tenant-scoped: { tenantId: 1, sku: 1 }
    expect(resB.status).toBe(201);
    expect(resB.body.success).toBe(true);
    expect(resB.body.data.sku).toBe('UNIVERSAL-01');
    expect(resB.body.data.tenantId).toBe(tenantB._id);
  });

  // TEST 3: Preventing Duplicate SKU / Barcode within the SAME Tenant
  it('3. Rejects duplicate barcode within the SAME tenant', async () => {
    await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        name: 'Apex Clipper 1',
        barcode: 'SAME-BARCODE-1',
        pricing: { retailPrice: 1000 },
      });

    const resDuplicate = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        name: 'Apex Clipper 2',
        barcode: 'SAME-BARCODE-1',
        pricing: { retailPrice: 1200 },
      });

    expect(resDuplicate.status).toBe(409);
    expect(resDuplicate.body.error.code).toBe('BARCODE_IN_USE');
  });

  // TEST 4: Cross-Tenant Data Leakage (Read Isolation)
  it('4. Denies Seller B from reading Seller A product (returns 404)', async () => {
    // Seller A creates a secret product
    const createRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        name: 'Confidential Apex Item',
        pricing: { retailPrice: 9999 },
      });
    const secretProductId = createRes.body.data._id;

    // Seller B tries to fetch Seller A's product using Seller A's ID
    const leakRes = await request(app)
      .get(`/api/v1/products/${secretProductId}`)
      .set('Authorization', `Bearer ${sellerBToken}`);

    // Must return 404 (does not exist in Seller B's tenant context)
    expect(leakRes.status).toBe(404);
    expect(leakRes.body.error.code).toBe('NOT_FOUND');
  });

  // TEST 5: Cross-Tenant List Isolation
  it('5. Ensures Seller B product list never contains Seller A products', async () => {
    // Seller A creates 3 products
    for (let i = 1; i <= 3; i++) {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${sellerAToken}`)
        .send({
          name: `Apex Item ${i}`,
          pricing: { retailPrice: 1000 * i },
        });
      expect(res.status).toBe(201);
    }

    // Seller B creates 1 product
    await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${sellerBToken}`)
      .send({
        name: 'Boutique Exclusive Item',
        pricing: { retailPrice: 5000 },
      });

    // Seller B lists products
    const listB = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${sellerBToken}`);

    expect(listB.status).toBe(200);
    expect(listB.body.data.length).toBe(1);
    expect(listB.body.data[0].name).toBe('Boutique Exclusive Item');

    // Seller A lists products
    const listA = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${sellerAToken}`);

    expect(listA.status).toBe(200);
    expect(listA.body.data.length).toBe(3);
  });

  // TEST 6: Cross-Tenant Mutation & Deletion Protection
  it('6. Denies Seller B from updating or deleting Seller A products', async () => {
    const prodRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        name: 'Apex Protected Product',
        pricing: { retailPrice: 3000 },
      });
    const targetId = prodRes.body.data._id;

    // Seller B attempts to overwrite price
    const updateRes = await request(app)
      .put(`/api/v1/products/${targetId}`)
      .set('Authorization', `Bearer ${sellerBToken}`)
      .send({
        name: 'Hacked Name',
        pricing: { retailPrice: 1 },
      });

    expect(updateRes.status).toBe(404);

    // Verify original product unchanged in DB
    const pristine = await Product.findById(targetId);
    expect(pristine.name).toBe('Apex Protected Product');
    expect(pristine.pricing.retailPrice).toBe(3000);

    // Seller B attempts to delete Seller A's product
    const deleteRes = await request(app)
      .delete(`/api/v1/products/${targetId}`)
      .set('Authorization', `Bearer ${sellerBToken}`);

    expect(deleteRes.status).toBe(404);

    // Verify still exists in DB
    const stillExists = await Product.findById(targetId);
    expect(stillExists).toBeDefined();
  });

  // TEST 7: Spoofed Header / Identifier-Guessing Attack
  it('7. Rejects spoofed x-tenant-id header when user has no membership in target tenant', async () => {
    // Seller B sends their valid token, but spoofs 'x-tenant-id' pointing to Tenant A
    const spoofRes = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${sellerBToken}`)
      .set('x-tenant-id', String(tenantA._id));

    // Middleware must reject because Seller B is NOT a member of Tenant A
    expect(spoofRes.status).toBe(403);
    expect(spoofRes.body.error.code).toBe('NO_TENANT_MEMBERSHIP');
  });

  // TEST 8: RBAC & Permission Enforcement within Tenant
  it('8. Enforces role-based permissions: Cashier can read catalog but cannot modify branding or manage staff', async () => {
    // Seller A (Owner) invites a Cashier
    const inviteRes = await request(app)
      .post('/api/v1/tenants/members')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        name: 'Tariq Cashier',
        email: 'tariq@apex.com',
        password: 'Password123!',
        role: ROLES.CASHIER,
      });

    expect(inviteRes.status).toBe(201);

    // Log in as Cashier
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'tariq@apex.com',
        password: 'Password123!',
      });

    expect(loginRes.status).toBe(200);
    const cashierToken = loginRes.body.data.token;

    // 1. Cashier CAN read products (has catalog:read)
    const readRes = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(readRes.status).toBe(200);

    // 2. Cashier CANNOT update store branding (requires tenant:settings)
    const brandingRes = await request(app)
      .put('/api/v1/tenants/profile')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ name: 'Cashier Changed Store Name' });
    expect(brandingRes.status).toBe(403);
    expect(brandingRes.body.error.code).toBe('PERMISSION_DENIED');

    // 3. Cashier CANNOT invite staff (requires staff:manage)
    const addStaffRes = await request(app)
      .post('/api/v1/tenants/members')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        name: 'Fake Staff',
        email: 'fake@apex.com',
        password: 'Password123!',
        role: ROLES.BUSINESS_MANAGER,
      });
    expect(addStaffRes.status).toBe(403);
    expect(addStaffRes.body.error.code).toBe('PERMISSION_DENIED');
  });

  // TEST 9: Reject Unauthenticated Requests
  it('9. Rejects unauthenticated requests with 401 UNAUTHENTICATED', async () => {
    const res = await request(app).get('/api/v1/products');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});
