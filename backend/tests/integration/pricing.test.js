import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDb, clearTestDb, closeTestDb } from '../setup.js';
import { createApp } from '../../src/app.js';
import { Product } from '../../src/modules/products/Product.js';
import { calculateOrderPricing } from '../../src/modules/orders/pricingService.js';

describe('Server-Authoritative Pricing & Financial Calculations', () => {
  let app;
  let sellerToken;
  let tenant;
  let productA, productB, productWholesale;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  }, 180000);

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Register Merchant
    const res = await request(app)
      .post('/api/v1/auth/register-tenant')
      .send({
        tenantName: 'Pricing Test Store',
        slug: 'pricing-store',
        subdomain: 'pricing',
        ownerName: 'Owner Test',
        email: 'owner@pricing.com',
        password: 'Password123!',
        phone: '03001234567',
      });

    expect(res.status).toBe(201);
    sellerToken = res.body.data.token;
    tenant = res.body.data.tenant;

    // 2. Create Test Products
    // Product A: Standard item with distinct retail, website, and cost prices
    productA = await Product.create({
      tenantId: tenant._id,
      name: 'Wireless Earbuds',
      slug: 'wireless-earbuds',
      sku: 'EAR-001',
      barcode: '100000000001',
      pricing: {
        costPrice: 800,
        retailPrice: 2000,
        websitePrice: 1800,
        wholesalePrice: 1200,
        minWholesaleQty: 5,
      },
      stock: 100,
      deliveryCharges: 200,
    });

    // Product B: Accessory
    productB = await Product.create({
      tenantId: tenant._id,
      name: 'Earbuds Silicone Case',
      slug: 'earbuds-silicone-case',
      sku: 'CASE-001',
      barcode: '100000000002',
      pricing: {
        costPrice: 150,
        retailPrice: 500,
        websitePrice: 450,
      },
      stock: 100,
      deliveryCharges: 200,
    });

    // Wholesale-targeted bulk item
    productWholesale = await Product.create({
      tenantId: tenant._id,
      name: 'Bulk USB Cables Box (100pcs)',
      slug: 'bulk-usb-cables-box',
      sku: 'USB-BOX',
      barcode: '100000000003',
      pricing: {
        costPrice: 3000,
        retailPrice: 6000,
        wholesalePrice: 4500,
        minWholesaleQty: 3,
      },
      stock: 50,
      deliveryCharges: 0,
    });
  });

  // TEST 1: Channel-Specific Pricing Resolution
  describe('Channel Pricing Engine', () => {
    it('1. Resolves websitePrice for online channel', async () => {
      const pricing = await calculateOrderPricing({
        tenantId: tenant._id,
        channel: 'online',
        items: [{ productId: productA._id, quantity: 1 }],
      });

      // Website price is 1800
      expect(pricing.lineItems[0].unitPriceSnapshot).toBe(1800);
      expect(pricing.financials.subtotal).toBe(1800);
    });

    it('2. Resolves retailPrice for retail/POS channel', async () => {
      const pricing = await calculateOrderPricing({
        tenantId: tenant._id,
        channel: 'retail',
        items: [{ productId: productA._id, quantity: 1 }],
      });

      // Retail price is 2000
      expect(pricing.lineItems[0].unitPriceSnapshot).toBe(2000);
      expect(pricing.financials.subtotal).toBe(2000);
    });

    it('3. Resolves wholesalePrice when quantity meets minWholesaleQty', async () => {
      // productWholesale minWholesaleQty is 3; buying 4
      const pricing = await calculateOrderPricing({
        tenantId: tenant._id,
        channel: 'wholesale',
        items: [{ productId: productWholesale._id, quantity: 4 }],
      });

      expect(pricing.lineItems[0].unitPriceSnapshot).toBe(4500); // wholesale price
      expect(pricing.financials.subtotal).toBe(4500 * 4); // 18000
    });

    it('4. Falls back to retailPrice when wholesale quantity is below minWholesaleQty', async () => {
      // productWholesale minWholesaleQty is 3; buying only 2
      const pricing = await calculateOrderPricing({
        tenantId: tenant._id,
        channel: 'wholesale',
        items: [{ productId: productWholesale._id, quantity: 2 }],
      });

      expect(pricing.lineItems[0].unitPriceSnapshot).toBe(6000); // retail price fallback
      expect(pricing.financials.subtotal).toBe(6000 * 2); // 12000
    });
  });

  // TEST 2: Shipping Engine Rules
  describe('Shipping Engine Rules', () => {
    it('5. Charges standard delivery (200) for online order when subtotal < 3000', async () => {
      const pricing = await calculateOrderPricing({
        tenantId: tenant._id,
        channel: 'online',
        items: [{ productId: productA._id, quantity: 1 }], // subtotal = 1800 (< 3000)
      });

      expect(pricing.financials.subtotal).toBe(1800);
      expect(pricing.financials.shippingFee).toBe(200);
      expect(pricing.financials.grandTotal).toBe(2000); // 1800 + 200
    });

    it('6. Grants free shipping for online order when subtotal >= 3000 threshold', async () => {
      const pricing = await calculateOrderPricing({
        tenantId: tenant._id,
        channel: 'online',
        items: [{ productId: productA._id, quantity: 2 }], // subtotal = 3600 (>= 3000)
      });

      expect(pricing.financials.subtotal).toBe(3600);
      expect(pricing.financials.shippingFee).toBe(0); // FREE
      expect(pricing.financials.grandTotal).toBe(3600);
    });

    it('7. Grants 0 shipping fee for POS and wholesale walk-in orders', async () => {
      const posPricing = await calculateOrderPricing({
        tenantId: tenant._id,
        channel: 'retail',
        items: [{ productId: productA._id, quantity: 1 }],
      });

      expect(posPricing.financials.shippingFee).toBe(0);

      const wholesalePricing = await calculateOrderPricing({
        tenantId: tenant._id,
        channel: 'wholesale',
        items: [{ productId: productA._id, quantity: 5 }],
      });

      expect(wholesalePricing.financials.shippingFee).toBe(0);
    });
  });

  // TEST 3: Coupons and Promotional Discounts
  describe('Coupons and Promotions', () => {
    it('8. Applies 10% discount for SAVE10 coupon code', async () => {
      const pricing = await calculateOrderPricing({
        tenantId: tenant._id,
        channel: 'online',
        items: [{ productId: productA._id, quantity: 2 }], // 3600 subtotal, 0 shipping
        couponCode: 'SAVE10',
      });

      expect(pricing.appliedCoupon).toEqual({
        code: 'SAVE10',
        type: 'percentage',
        amount: 360,
      });
      expect(pricing.financials.discountTotal).toBe(360);
      expect(pricing.financials.grandTotal).toBe(3600 - 360); // 3240
    });

    it('9. Applies FLAT200 fixed coupon when subtotal >= 1000', async () => {
      const pricing = await calculateOrderPricing({
        tenantId: tenant._id,
        channel: 'online',
        items: [{ productId: productA._id, quantity: 1 }], // 1800 subtotal, 200 shipping
        couponCode: 'FLAT200',
      });

      expect(pricing.appliedCoupon).toEqual({
        code: 'FLAT200',
        type: 'fixed',
        amount: 200,
      });
      expect(pricing.financials.discountTotal).toBe(200);
      // grandTotal = subtotal (1800) + shipping (200) - discount (200) = 1800
      expect(pricing.financials.grandTotal).toBe(1800);
    });
  });

  // TEST 4: Profitability & Financial Tracking (COGS and Gross Profit)
  describe('Profitability & COGS Audit', () => {
    it('10. Accurately calculates COGS and Gross Profit', async () => {
      // 2 * productA (Cost: 800 ea = 1600, Website: 1800 ea = 3600)
      // 1 * productB (Cost: 150 ea = 150, Website: 450 ea = 450)
      // Total Subtotal = 4050 (Free shipping since >= 3000)
      // Total COGS = 1600 + 150 = 1750
      // Gross Profit = 4050 - 0 (shipping) - 1750 = 2300
      const pricing = await calculateOrderPricing({
        tenantId: tenant._id,
        channel: 'online',
        items: [
          { productId: productA._id, quantity: 2 },
          { productId: productB._id, quantity: 1 },
        ],
      });

      expect(pricing.financials.subtotal).toBe(4050);
      expect(pricing.financials.shippingFee).toBe(0);
      expect(pricing.financials.cogsTotal).toBe(1750);
      expect(pricing.financials.grandTotal).toBe(4050);
      expect(pricing.financials.grossProfit).toBe(2300);
    });
  });

  // TEST 5: Security Mandate — Server Ignores Client-Submitted Fake Prices
  describe('Security Mandate & Client Override Rejection', () => {
    it('11. Strictly ignores client-submitted price tampering via HTTP API', async () => {
      // Attacker attempts to buy productA (Rs. 1800) for Rs. 50 with 0 shipping
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          channel: 'online',
          customer: {
            name: 'Malicious Actor',
            phone: '03009999999',
          },
          items: [
            {
              productId: productA._id,
              quantity: 1,
              unitPrice: 50,       // FORGED
              unitPriceSnapshot: 50, // FORGED
              lineTotal: 50,       // FORGED
            },
          ],
          financials: {
            subtotal: 50,         // FORGED
            shippingFee: 0,       // FORGED
            grandTotal: 50,       // FORGED
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const createdOrder = res.body.data;
      // Server must have completely ignored forged numbers:
      expect(createdOrder.items[0].unitPriceSnapshot).toBe(1800);
      expect(createdOrder.financials.subtotal).toBe(1800);
      expect(createdOrder.financials.shippingFee).toBe(200); // 1800 < 3000 threshold
      expect(createdOrder.financials.grandTotal).toBe(2000); // 1800 + 200
      expect(createdOrder.financials.cogsTotal).toBe(800);
      expect(createdOrder.financials.grossProfit).toBe(1000); // (2000 - 200) - 800
    });
  });
});
