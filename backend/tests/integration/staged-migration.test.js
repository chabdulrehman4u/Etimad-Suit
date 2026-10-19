import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { connectTestDb, clearTestDb, closeTestDb } from '../setup.js';
import { runMigration } from '../../../scripts/migration/runMigration.js';
import { Tenant } from '../../src/modules/tenants/Tenant.js';
import { Product } from '../../src/modules/products/Product.js';
import { Order } from '../../src/modules/orders/Order.js';
import { StockLedger } from '../../src/modules/inventory/StockLedger.js';
import { WholesaleCustomer } from '../../src/modules/wholesale/WholesaleCustomer.js';
import { Supplier } from '../../src/modules/purchases/Supplier.js';
import { TenantMembership } from '../../src/modules/tenants/TenantMembership.js';

describe('Phase 9: Staged Migration, Staging Verification & Zero-Downtime Cutover Suite', () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 180000);

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it('1. Executes end-to-end staged migration and verifies 100% reconciliation match and zero orphans', async () => {
    // 1. Build simulated legacy dataset matching the audited models
    const legacyData = {
      // Legacy Users
      ecommerceUsers: [
        {
          name: 'Ecommerce Admin',
          email: 'online-lead@etimadmart.com',
          password: '$2a$10$ecomEncryptedPasswordHashExample',
          role: 'admin',
          phone: '03001111111',
        },
        {
          name: 'Loyal Shopper',
          email: 'customer@gmail.com',
          role: 'customer',
          phone: '03212222222',
        },
      ],
      imsUsers: [
        {
          name: 'IMS Superadmin',
          email: 'admin@etimadmart.com',
          password: '$2a$10$imsEncryptedPasswordHashExample',
          role: 'superadmin',
          phone: '03001234567',
        },
        {
          name: 'Store Cashier',
          email: 'cashier@etimadmart.com',
          password: '$2a$10$cashierPasswordHashExample',
          role: 'seller',
          phone: '03333333333',
        },
      ],

      // Legacy Products (Simulating matching by Barcode and Model)
      ecommerceProducts: [
        {
          name: 'Etimad Smart Blender Pro',
          title: 'Etimad Smart Blender Pro',
          slug: 'etimad-smart-blender-pro',
          sku: 'BLD-PRO',
          barcode: '8964000111222',
          price: 7500,
          costPrice: 4000,
          stock: 12, // Out-of-date stock on website
          description: 'High performance kitchen blender with 6 stainless steel blades',
          images: [
            { url: 'https://res.cloudinary.com/etimad/image/upload/v1/blender1.jpg', isPrimary: true },
            { url: 'https://res.cloudinary.com/etimad/image/upload/v1/blender2.jpg', isPrimary: false },
          ],
        },
        {
          name: 'Online Exclusive Electric Kettle',
          title: 'Online Exclusive Electric Kettle',
          slug: 'electric-kettle-1-8l',
          sku: 'KET-ECOM',
          price: 3200,
          costPrice: 1800,
          stock: 25,
          images: [{ url: 'https://res.cloudinary.com/etimad/image/upload/v1/kettle.jpg', isPrimary: true }],
        },
      ],

      imsProducts: [
        {
          name: 'Smart Blender Pro (IMS Name)',
          model: 'BLD-PRO',
          barcode: '8964000111222', // Matches Ecommerce product by barcode!
          originalPrice: 4200, // Authoritative actual cost price from purchase batch
          retailPrice: 7500,
          wholesalePrice: 6200,
          stock: 48, // Authoritative physical stock in warehouse
        },
        {
          name: 'Heavy Duty Sandwich Maker',
          model: 'SND-09',
          barcode: '8964000333444',
          originalPrice: 2200,
          retailPrice: 3900,
          wholesalePrice: 3100,
          stock: 15, // IMS-only product
        },
      ],

      // Legacy Customers & Suppliers
      customers: [
        {
          name: 'Tariq Wholesale Traders',
          phone: '03009998888',
          email: 'tariq@traders.pk',
          city: 'Gujranwala',
          creditLimit: 500000,
          khataDebt: 125000,
          priceTier: 'tier_1',
        },
      ],
      suppliers: [
        {
          name: 'Al-Madina Appliances Ltd',
          company: 'Al-Madina Imports',
          phone: '04231234567',
          email: 'orders@almadina.pk',
          payableBalance: 340000,
        },
      ],

      // Legacy Orders across all 3 channels
      ecommerceOrders: [
        {
          orderNumber: 'ECOM-1001',
          customerName: 'Asad Butt',
          customerPhone: '03215555555',
          shippingAddress: { address: 'House 42, St 1', city: 'Islamabad' },
          shippingPrice: 250,
          isPaid: true,
          status: 'Delivered',
          courier: { provider: 'lcs', trackingNumber: 'LCS-MIG-001' },
          items: [
            {
              name: 'Etimad Smart Blender Pro',
              sku: 'BLD-PRO',
              quantity: 1,
              price: 7500,
              costPrice: 4200,
            },
          ],
        },
      ],
      imsBills: [
        {
          billNumber: 'BILL-5001',
          customerName: 'Walk-in Counter Guest',
          customerPhone: '03000000000',
          totalAmount: 3900,
          paidAmount: 3900,
          paymentType: 'cash',
          items: [
            {
              name: 'Heavy Duty Sandwich Maker',
              sku: 'SND-09',
              quantity: 1,
              retailPrice: 3900,
              costPrice: 2200,
            },
          ],
        },
      ],
      wholesaleDispatches: [
        {
          dispatchNumber: 'DSP-9001',
          customerName: 'Tariq Wholesale Traders',
          customerPhone: '03009998888',
          totalAmount: 31000,
          amountPaid: 10000,
          totalUnits: 10,
        },
      ],
    };

    // 2. Execute Migration Pipeline
    const result = await runMigration({ legacyData });

    expect(result.success).toBe(true);
    expect(result.auditReport.status).toBe('PASSED');

    // 3. Verify Flagship Tenant Setup
    const tenant = await Tenant.findOne({ slug: 'etimadmart' });
    expect(tenant).toBeDefined();
    expect(tenant.name).toBe('Etimad Mart (Flagship)');
    expect(tenant.customDomains[0].domain).toBe('etimadmart.com');
    expect(tenant.customDomains[0].isVerified).toBe(true);

    // 4. Verify Zero Orphans Invariant
    expect(result.auditReport.invariants.zeroOrphans).toBe(true);
    const orphanCount = await Product.countDocuments({ tenantId: { $exists: false } });
    expect(orphanCount).toBe(0);

    // 5. Verify Product Reconciliation & Physical Stock Truth
    // Total products should be 3: 1 matched + 1 ecom-only + 1 ims-only
    const products = await Product.find({ tenantId: tenant._id });
    expect(products.length).toBe(3);

    // The matched blender must take its physical stock (48) from IMS, NOT from ecom (12)!
    const matchedBlender = products.find((p) => p.sku === 'BLD-PRO');
    expect(matchedBlender).toBeDefined();
    expect(matchedBlender.stock).toBe(48); // IMS authoritative physical inventory
    expect(matchedBlender.pricing.costPrice).toBe(4200); // IMS authoritative landed cost
    expect(matchedBlender.images.length).toBe(2); // Retained rich Cloudinary images from Ecommerce!
    expect(matchedBlender.slug).toBe('etimad-smart-blender-pro');

    // 6. Verify Authoritative StockLedger Openings
    const stockLedgers = await StockLedger.find({ tenantId: tenant._id });
    expect(stockLedgers.length).toBe(3);
    const totalPhysicalStock = products.reduce((acc, p) => acc + p.stock, 0);
    const totalLedgerStock = stockLedgers.reduce((acc, l) => acc + l.delta, 0);
    expect(totalPhysicalStock).toBe(totalLedgerStock);
    expect(totalPhysicalStock).toBe(48 + 25 + 15); // 88 total physical units

    // 7. Verify Multi-Channel Orders Ingestion
    const orders = await Order.find({ tenantId: tenant._id });
    expect(orders.length).toBe(3);

    const onlineOrder = orders.find((o) => o.channel === 'online');
    expect(onlineOrder).toBeDefined();
    expect(onlineOrder.orderNumber).toBe('ECOM-1001');
    expect(onlineOrder.financials.grandTotal).toBe(7750); // 7500 + 250 shipping
    expect(onlineOrder.payment.status).toBe('paid');

    const retailOrder = orders.find((o) => o.channel === 'retail');
    expect(retailOrder).toBeDefined();
    expect(retailOrder.orderNumber).toBe('BILL-5001');
    expect(retailOrder.financials.grandTotal).toBe(3900);

    const wholesaleOrder = orders.find((o) => o.channel === 'wholesale');
    expect(wholesaleOrder).toBeDefined();
    expect(wholesaleOrder.orderNumber).toBe('DSP-9001');
    expect(wholesaleOrder.financials.outstandingBalance).toBe(21000); // 31000 - 10000

    // 8. Verify Customer & Supplier Khatas
    const customer = await WholesaleCustomer.findOne({ tenantId: tenant._id, phone: '03009998888' });
    expect(customer).toBeDefined();
    expect(customer.outstandingBalance).toBe(125000);

    const supplier = await Supplier.findOne({ tenantId: tenant._id, phone: '04231234567' });
    expect(supplier).toBeDefined();
    expect(supplier.payableBalance).toBe(340000);

    // 9. Verify Staff Memberships
    const memberships = await TenantMembership.find({ tenantId: tenant._id });
    expect(memberships.length).toBeGreaterThanOrEqual(3);
  });

  it('2. Proves migration script idempotency: running twice causes 0 duplicate records and 0 stock inflation', async () => {
    const legacyData = {
      ecommerceProducts: [
        {
          name: 'Idempotency Test Item',
          sku: 'IDEM-01',
          price: 5000,
          costPrice: 2500,
          stock: 10,
        },
      ],
      imsBills: [
        {
          billNumber: 'BILL-IDEM-01',
          totalAmount: 5000,
          paidAmount: 5000,
        },
      ],
    };

    // First execution
    const run1 = await runMigration({ legacyData });
    expect(run1.success).toBe(true);

    const tenantId = run1.flagshipTenant.id;
    const prodCount1 = await Product.countDocuments({ tenantId });
    const orderCount1 = await Order.countDocuments({ tenantId });
    const ledgerCount1 = await StockLedger.countDocuments({ tenantId });

    // Second execution (re-run / retry)
    const run2 = await runMigration({ legacyData });
    expect(run2.success).toBe(true);

    const prodCount2 = await Product.countDocuments({ tenantId });
    const orderCount2 = await Order.countDocuments({ tenantId });
    const ledgerCount2 = await StockLedger.countDocuments({ tenantId });

    // Exact count match: no duplicates created!
    expect(prodCount2).toBe(prodCount1);
    expect(orderCount2).toBe(orderCount1);
    expect(ledgerCount2).toBe(ledgerCount1);
  });
});
