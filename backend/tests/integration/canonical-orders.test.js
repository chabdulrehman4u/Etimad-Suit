import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDb, clearTestDb, closeTestDb } from '../setup.js';
import { createApp } from '../../src/app.js';
import { Product } from '../../src/modules/products/Product.js';
import { Order } from '../../src/modules/orders/Order.js';
import { StockLedger } from '../../src/modules/inventory/StockLedger.js';

describe('Canonical Orders & Omnichannel Stock Ledger Suite', () => {
  let app;
  let sellerAToken, sellerBToken;
  let tenantA, tenantB;
  let productA, productB;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  }, 180000);

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Register Seller A
    const resA = await request(app)
      .post('/api/v1/auth/register-tenant')
      .send({
        tenantName: 'Merchant Alpha',
        slug: 'merchant-alpha',
        subdomain: 'alpha',
        ownerName: 'Alpha Owner',
        email: 'alpha@test.com',
        password: 'Password123!',
        phone: '03001111111',
      });

    sellerAToken = resA.body.data.token;
    tenantA = resA.body.data.tenant;

    // 2. Register Seller B
    const resB = await request(app)
      .post('/api/v1/auth/register-tenant')
      .send({
        tenantName: 'Merchant Beta',
        slug: 'merchant-beta',
        subdomain: 'beta',
        ownerName: 'Beta Owner',
        email: 'beta@test.com',
        password: 'Password123!',
        phone: '03002222222',
      });

    sellerBToken = resB.body.data.token;
    tenantB = resB.body.data.tenant;

    // 3. Create Product for Seller A (10 in stock)
    productA = await Product.create({
      tenantId: tenantA._id,
      name: 'Alpha Gaming Mouse',
      slug: 'alpha-gaming-mouse',
      sku: 'MOUSE-A1',
      barcode: '300000000001',
      pricing: {
        costPrice: 1500,
        retailPrice: 3500,
        websitePrice: 3200,
      },
      stock: 10,
      freeShipping: false,
    });

    // 4. Create Product for Seller B (20 in stock)
    productB = await Product.create({
      tenantId: tenantB._id,
      name: 'Beta Office Keyboard',
      slug: 'beta-office-keyboard',
      sku: 'KB-B1',
      barcode: '300000000002',
      pricing: {
        costPrice: 2000,
        retailPrice: 4000,
      },
      stock: 20,
    });
  });

  // TEST 1: Omnichannel Stock Synchronization (Retail POS + Online Store)
  it('1. Synchronizes stock across Retail POS and Online Store channels from ONE single truth', async () => {
    // A. Retail POS Cashier sells 3 units in person
    const posRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        channel: 'retail',
        customer: {
          name: 'Walk-in Customer',
          phone: '03000000000',
        },
        items: [
          {
            productId: productA._id,
            quantity: 3,
          },
        ],
        payment: {
          method: 'cash',
        },
      });

    expect(posRes.status).toBe(201);
    expect(posRes.body.success).toBe(true);
    const posOrder = posRes.body.data;
    expect(posOrder.channel).toBe('retail');
    expect(posOrder.fulfillment.status).toBe('delivered');
    expect(posOrder.payment.status).toBe('paid');
    // Retail price 3500 * 3 = 10500, shipping 0
    expect(posOrder.financials.grandTotal).toBe(10500);

    // Verify product stock dropped from 10 to 7
    let reloadedProduct = await Product.findById(productA._id);
    expect(reloadedProduct.stock).toBe(7);

    // B. Online Customer places order for 4 units on the web
    const onlineRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        channel: 'online',
        customer: {
          name: 'Usman Ali',
          phone: '03211234567',
          shippingAddress: {
            street: 'Main Blvd 42',
            city: 'Lahore',
          },
        },
        items: [
          {
            productId: productA._id,
            quantity: 4,
          },
        ],
        payment: {
          method: 'cod',
        },
      });

    expect(onlineRes.status).toBe(201);
    expect(onlineRes.body.success).toBe(true);
    const onlineOrder = onlineRes.body.data;
    expect(onlineOrder.channel).toBe('online');
    expect(onlineOrder.fulfillment.status).toBe('pending');
    expect(onlineOrder.payment.status).toBe('unpaid');
    // Website price 3200 * 4 = 12800 (>= 3000 -> free shipping)
    expect(onlineOrder.financials.subtotal).toBe(12800);
    expect(onlineOrder.financials.shippingFee).toBe(0);
    expect(onlineOrder.financials.grandTotal).toBe(12800);

    // Verify product stock dropped from 7 to 3
    reloadedProduct = await Product.findById(productA._id);
    expect(reloadedProduct.stock).toBe(3);

    // C. Verify Live Balances Endpoint reflects 3 units
    const balanceRes = await request(app)
      .get('/api/v1/inventory/balances')
      .set('Authorization', `Bearer ${sellerAToken}`);

    expect(balanceRes.status).toBe(200);
    expect(balanceRes.body.data[0].stock).toBe(3);

    // D. Verify Stock Ledger has both movements with audit history
    const ledgerEntries = await StockLedger.find({
      tenantId: tenantA._id,
      productId: productA._id,
    }).sort({ createdAt: 1 });

    expect(ledgerEntries.length).toBe(2);
    expect(ledgerEntries[0].delta).toBe(-3);
    expect(ledgerEntries[0].previousStock).toBe(10);
    expect(ledgerEntries[0].newStock).toBe(7);

    expect(ledgerEntries[1].delta).toBe(-4);
    expect(ledgerEntries[1].previousStock).toBe(7);
    expect(ledgerEntries[1].newStock).toBe(3);
  });

  // TEST 2: Idempotency Key Deduplication via API
  it('2. Prevents double-order and double-decrement via Idempotency-Key HTTP header', async () => {
    const idempotencyKey = 'order-idem-abc-123';

    const orderPayload = {
      channel: 'online',
      customer: {
        name: 'Tariq Mehmood',
        phone: '03331112233',
      },
      items: [
        {
          productId: productA._id,
          quantity: 2,
        },
      ],
    };

    // First request
    const firstRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(orderPayload);

    expect(firstRes.status).toBe(201);
    expect(firstRes.body.isDuplicate).toBe(false);
    const orderId = firstRes.body.data._id;

    // Stock should be 10 - 2 = 8
    let reloadedProduct = await Product.findById(productA._id);
    expect(reloadedProduct.stock).toBe(8);

    // Second request with SAME idempotency key (simulating network retry/double-click)
    const secondRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(orderPayload);

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.isDuplicate).toBe(true);
    expect(secondRes.body.data._id).toBe(orderId);

    // Stock MUST still be 8 (NOT 6!)
    reloadedProduct = await Product.findById(productA._id);
    expect(reloadedProduct.stock).toBe(8);

    // Only 1 order document in DB
    const orderCount = await Order.countDocuments({
      tenantId: tenantA._id,
      idempotencyKey,
    });
    expect(orderCount).toBe(1);
  });

  // TEST 3: Order Cancellation Restores Physical Stock
  it('3. Restores physical inventory when an order is cancelled', async () => {
    // 1. Create order for 3 items (stock: 10 -> 7)
    const createRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        channel: 'online',
        customer: {
          name: 'Hamza Sheikh',
          phone: '03451122334',
        },
        items: [
          {
            productId: productA._id,
            quantity: 3,
          },
        ],
      });

    const orderId = createRes.body.data._id;
    let prod = await Product.findById(productA._id);
    expect(prod.stock).toBe(7);

    // 2. Cancel order
    const cancelRes = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        fulfillmentStatus: 'cancelled',
        note: 'Customer requested cancellation via phone',
      });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.fulfillment.status).toBe('cancelled');

    // 3. Verify physical stock is restored from 7 back to 10
    prod = await Product.findById(productA._id);
    expect(prod.stock).toBe(10);

    // 4. Verify STOCK_RELEASE ledger entry exists
    const releaseEntry = await StockLedger.findOne({
      tenantId: tenantA._id,
      productId: productA._id,
      type: 'STOCK_RELEASE',
    });

    expect(releaseEntry).toBeDefined();
    expect(releaseEntry.delta).toBe(3);
    expect(releaseEntry.newStock).toBe(10);
  });

  // TEST 4: Cross-Tenant Isolation on Orders and Inventory
  it('4. Strictly isolates orders and inventory between Seller A and Seller B', async () => {
    // Seller A creates an order
    const resA = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        channel: 'online',
        customer: {
          name: 'Private Customer A',
          phone: '03001234567',
        },
        items: [
          {
            productId: productA._id,
            quantity: 1,
          },
        ],
      });

    const orderIdA = resA.body.data._id;

    // 1. Seller B attempts to fetch Seller A's order by ID -> 404 NOT FOUND
    const getResB = await request(app)
      .get(`/api/v1/orders/${orderIdA}`)
      .set('Authorization', `Bearer ${sellerBToken}`);

    expect(getResB.status).toBe(404);
    expect(getResB.body.error.code).toBe('NOT_FOUND');

    // 2. Seller B lists orders -> 0 orders found
    const listResB = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${sellerBToken}`);

    expect(listResB.status).toBe(200);
    expect(listResB.body.data.length).toBe(0);

    // 3. Seller B views inventory balances -> only sees their own productB, NEVER productA
    const invResB = await request(app)
      .get('/api/v1/inventory/balances')
      .set('Authorization', `Bearer ${sellerBToken}`);

    expect(invResB.status).toBe(200);
    expect(invResB.body.data.length).toBe(1);
    expect(invResB.body.data[0].name).toBe('Beta Office Keyboard');

    // 4. Seller B views inventory ledger -> 0 entries (cannot see Seller A's deductions)
    const ledgerResB = await request(app)
      .get('/api/v1/inventory/ledger')
      .set('Authorization', `Bearer ${sellerBToken}`);

    expect(ledgerResB.status).toBe(200);
    expect(ledgerResB.body.data.length).toBe(0);
  });
});
