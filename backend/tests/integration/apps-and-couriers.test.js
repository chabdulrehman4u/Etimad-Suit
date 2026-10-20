import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDb, clearTestDb, closeTestDb } from '../setup.js';
import { createApp } from '../../src/app.js';
import { Product } from '../../src/modules/products/Product.js';
import { Order } from '../../src/modules/orders/Order.js';
import { Parcel } from '../../src/modules/logistics/Parcel.js';
import { AppConnection } from '../../src/modules/apps/AppConnection.js';
import { encrypt, decrypt } from '../../src/utils/crypto.js';

describe('Apps Framework & Verified Courier Adapters Suite', () => {
  let app;
  let sellerAToken, sellerBToken;
  let tenantA, tenantB;
  let productA;
  let orderA;

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
        tenantName: 'Swift Retail',
        slug: 'swift-retail',
        subdomain: 'swift',
        ownerName: 'Hamza Tariq',
        email: 'hamza@swift.com',
        password: 'Password123!',
        phone: '03001234567',
      });

    sellerAToken = resA.body.data.token;
    tenantA = resA.body.data.tenant;

    // 2. Register Seller B
    const resB = await request(app)
      .post('/api/v1/auth/register-tenant')
      .send({
        tenantName: 'Urban Store',
        slug: 'urban-store',
        subdomain: 'urban',
        ownerName: 'Bilal Khan',
        email: 'bilal@urban.com',
        password: 'Password123!',
        phone: '03007654321',
      });

    sellerBToken = resB.body.data.token;
    tenantB = resB.body.data.tenant;

    // 3. Create Product for Seller A
    productA = await Product.create({
      tenantId: tenantA._id,
      name: 'Wireless PowerBank 20000mAh',
      slug: 'wireless-powerbank-20000mah',
      sku: 'PB-20K',
      barcode: '778899001122',
      pricing: {
        costPrice: 2000,
        retailPrice: 4500,
        websitePrice: 4200,
      },
      stock: 50,
    });

    // 4. Create an Online Customer Order for Seller A
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        channel: 'online',
        customer: {
          name: 'Asad Rauf',
          phone: '03211234567',
          shippingAddress: {
            street: 'Gulberg Main Blvd',
            city: 'Lahore',
          },
        },
        items: [{ productId: productA._id, quantity: 1 }],
      });

    orderA = orderRes.body.data;
  });

  // TEST 1: AES-256-GCM Encryption at Rest for Merchant Integration Credentials
  it('1. Securely encrypts provider credentials at rest with AES-256-GCM and masks secrets in API responses', async () => {
    const rawApiKey = 'sk_live_leopards_secret_key_998877';
    const rawApiPassword = 'super_confidential_password_123';

    // Connect Leopards courier app
    const connectRes = await request(app)
      .post('/api/v1/apps/connections')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        providerId: 'lcs',
        category: 'courier',
        credentials: {
          apiKey: rawApiKey,
          apiPassword: rawApiPassword,
        },
        settings: {
          defaultOriginCityId: '36',
          testMode: true,
        },
      });

    expect(connectRes.status).toBe(201);
    expect(connectRes.body.success).toBe(true);
    expect(connectRes.body.data.status).toBe('connected');

    // VERIFY API MASKING: Plaintext secrets must NEVER be returned in full
    const masked = connectRes.body.data.maskedCredentials;
    expect(masked.apiKey).not.toBe(rawApiKey);
    expect(masked.apiKey).toContain('****');
    expect(masked.apiPassword).not.toBe(rawApiPassword);
    expect(masked.apiPassword).toContain('****');

    // VERIFY DATABASE ENCRYPTION AT REST:
    // Raw database document MUST contain AES-256-GCM ciphertext, NOT plaintext!
    const dbDoc = await AppConnection.findOne({ tenantId: tenantA._id, providerId: 'lcs' });
    expect(dbDoc).toBeDefined();
    expect(dbDoc.encryptedCredentials).toBeDefined();

    // Check ciphertext format: ivHex:authTagHex:encryptedHex
    const parts = dbDoc.encryptedCredentials.split(':');
    expect(parts.length).toBe(3);
    expect(parts[0].length).toBe(24); // 12 bytes IV in hex
    expect(parts[1].length).toBe(32); // 16 bytes auth tag in hex

    // Confirm plaintext does NOT appear anywhere in the ciphertext string
    expect(dbDoc.encryptedCredentials.includes('sk_live_leopards')).toBe(false);
    expect(dbDoc.encryptedCredentials.includes('super_confidential')).toBe(false);

    // Confirm decryption utility successfully restores original credentials
    const decrypted = dbDoc.getDecryptedCredentials();
    expect(decrypted.apiKey).toBe(rawApiKey);
    expect(decrypted.apiPassword).toBe(rawApiPassword);
  });

  // TEST 2: Leopards (LCS) Shipment Booking via Adapter
  it('2. Books shipment with Leopards adapter, generates tracking number, label URL, and parcel record', async () => {
    // 1. Connect LCS with test mode
    await request(app)
      .post('/api/v1/apps/connections')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        providerId: 'lcs',
        category: 'courier',
        credentials: { apiKey: 'test_lcs_key', apiPassword: 'test_lcs_pass' },
        settings: { testMode: true },
      });

    // 2. Book shipment for order
    const bookRes = await request(app)
      .post('/api/v1/apps/courier/book')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        providerId: 'lcs',
        orderId: orderA._id,
        parcelInfo: { weightGrams: 500, pieces: 1, remarks: 'Handle with care' },
      });

    expect(bookRes.status).toBe(201);
    expect(bookRes.body.success).toBe(true);

    const parcel = bookRes.body.data.parcel;
    expect(parcel.trackingNumber).toMatch(/^LCS-\d+/);
    expect(parcel.courier).toBe('lcs');
    expect(parcel.status).toBe('dispatched');

    const bookingResult = bookRes.body.data.bookingResult;
    expect(bookingResult.labelUrl).toContain(parcel.trackingNumber);

    // 3. Verify Order fulfillment status advanced to 'dispatched'
    const updatedOrder = await Order.findById(orderA._id);
    expect(updatedOrder.fulfillment.status).toBe('dispatched');
    expect(updatedOrder.fulfillment.courier.trackingNumber).toBe(parcel.trackingNumber);
    expect(updatedOrder.fulfillment.courier.provider).toBe('lcs');

    // 4. Test live tracking query
    const trackRes = await request(app)
      .get(`/api/v1/apps/courier/track/lcs/${parcel.trackingNumber}`)
      .set('Authorization', `Bearer ${sellerAToken}`);

    expect(trackRes.status).toBe(200);
    expect(trackRes.body.data.status).toBe('in_transit');
    expect(trackRes.body.data.history.length).toBeGreaterThan(0);
  });

  // TEST 3: PostEx Courier Integration
  it('3. Connects PostEx logistics, books shipment, and retrieves tracking updates', async () => {
    // 1. Connect PostEx
    await request(app)
      .post('/api/v1/apps/connections')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        providerId: 'postex',
        category: 'courier',
        credentials: { apiToken: 'postex_live_token_778899' },
        settings: { testMode: true },
      });

    // 2. Book shipment
    const bookRes = await request(app)
      .post('/api/v1/apps/courier/book')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        providerId: 'postex',
        orderId: orderA._id,
        parcelInfo: { remarks: 'Fragile electronics' },
      });

    expect(bookRes.status).toBe(201);
    const parcel = bookRes.body.data.parcel;
    expect(parcel.trackingNumber).toMatch(/^PEX-\d+/);
    expect(parcel.courier).toBe('postex');

    // 3. Track PostEx
    const trackRes = await request(app)
      .get(`/api/v1/apps/courier/track/postex/${parcel.trackingNumber}`)
      .set('Authorization', `Bearer ${sellerAToken}`);

    expect(trackRes.status).toBe(200);
    expect(trackRes.body.data.trackingNumber).toBe(parcel.trackingNumber);
    expect(trackRes.body.data.status).toBe('in_transit');
  });

  // TEST 4: Fault-Tolerant Resilience (Graceful Degradation During Courier Outage)
  it('4. Gracefully degrades during third-party courier outage without crashing or losing the order', async () => {
    // 1. Connect with testMode: false but fake invalid server URL (simulating provider API crash / network drop)
    await request(app)
      .post('/api/v1/apps/connections')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        providerId: 'lcs',
        category: 'courier',
        credentials: { apiKey: 'dummy_key', apiPassword: 'dummy_password' },
        settings: {
          testMode: false,
          baseUrl: 'http://127.0.0.1:59999/non_existent_courier_api/', // Unreachable dead endpoint
        },
      });

    // 2. Attempt shipment booking
    const bookRes = await request(app)
      .post('/api/v1/apps/courier/book')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        providerId: 'lcs',
        orderId: orderA._id,
      });

    // System MUST NOT crash with 500 error!
    // Instead, it gracefully accepts the booking into fallback queue (HTTP 202)
    expect(bookRes.status).toBe(202);
    expect(bookRes.body.fallback).toBe(true);
    expect(bookRes.body.warning).toContain('temporarily unavailable');

    // Confirm the order is preserved safely in the database
    const preservedOrder = await Order.findById(orderA._id);
    expect(preservedOrder).toBeDefined();

    // Confirm fallback parcel was recorded for manual dispatch
    const fallbackParcel = await Parcel.findOne({ orderId: orderA._id });
    expect(fallbackParcel).toBeDefined();
    expect(fallbackParcel.status).toBe('booked');
    expect(fallbackParcel.notes).toContain('Automated booking failed');
  });

  // TEST 5: Idempotent Webhook Receiver for Courier Delivery Callbacks
  it('5. Idempotently processes courier delivery callbacks via public webhook without duplicate logs', async () => {
    // 1. Create a parcel for testing webhook
    const testTracking = 'LCS-WEBHOOK-TEST-001';
    const parcel = await Parcel.create({
      tenantId: tenantA._id,
      orderId: orderA._id,
      orderNumber: orderA.orderNumber,
      trackingNumber: testTracking,
      courier: 'lcs',
      status: 'dispatched',
      customer: { name: 'Asad Rauf', phone: '03211234567' },
    });

    // 2. Courier sends delivery webhook
    const firstWebhookRes = await request(app)
      .post('/api/v1/apps/webhooks/lcs')
      .send({
        track_number: testTracking,
        status: 'DELIVERED',
        delivery_date: new Date().toISOString(),
      });

    expect(firstWebhookRes.status).toBe(200);
    expect(firstWebhookRes.body.success).toBe(true);
    expect(firstWebhookRes.body.isDuplicate).toBe(false);
    expect(firstWebhookRes.body.data.status).toBe('delivered');

    // Verify parcel status updated to 'delivered'
    let reloadedParcel = await Parcel.findById(parcel._id);
    expect(reloadedParcel.status).toBe('delivered');
    expect(reloadedParcel.deliveredAt).toBeDefined();

    // Verify order fulfillment status updated to 'delivered'
    let reloadedOrder = await Order.findById(orderA._id);
    expect(reloadedOrder.fulfillment.status).toBe('delivered');

    // 3. Courier replays identical webhook (network retry simulation)
    const secondWebhookRes = await request(app)
      .post('/api/v1/apps/webhooks/lcs')
      .send({
        track_number: testTracking,
        status: 'DELIVERED',
      });

    expect(secondWebhookRes.status).toBe(200);
    expect(secondWebhookRes.body.isDuplicate).toBe(true);

    // Order history must not have duplicate redundant entries
    reloadedOrder = await Order.findById(orderA._id);
    const webhookLogs = reloadedOrder.history.filter((h) => h.note?.includes('webhook callback'));
    expect(webhookLogs.length).toBe(1);
  });

  // TEST 6: Strict Multi-Tenant Isolation
  it('6. Strictly isolates app connections and credentials between Seller A and Seller B', async () => {
    // Seller A connects LCS
    await request(app)
      .post('/api/v1/apps/connections')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        providerId: 'lcs',
        credentials: { apiKey: 'seller_a_secret' },
      });

    // Seller B lists connections -> Must see 0 connections
    const listB = await request(app)
      .get('/api/v1/apps/connections')
      .set('Authorization', `Bearer ${sellerBToken}`);

    expect(listB.status).toBe(200);
    expect(listB.body.data.length).toBe(0);

    // Seller B attempts to book shipment using LCS -> Must fail (not connected for Tenant B)
    const bookB = await request(app)
      .post('/api/v1/apps/courier/book')
      .set('Authorization', `Bearer ${sellerBToken}`)
      .send({
        providerId: 'lcs',
        orderId: orderA._id,
      });

    expect(bookB.status).toBe(400);
    expect(bookB.body.error.message).toContain('not found in this store');
  });
});

