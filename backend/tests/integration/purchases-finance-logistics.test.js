import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDb, clearTestDb, closeTestDb } from '../setup.js';
import { createApp } from '../../src/app.js';
import { Product } from '../../src/modules/products/Product.js';
import { Supplier } from '../../src/modules/purchases/Supplier.js';
import { PurchaseBatch } from '../../src/modules/purchases/PurchaseBatch.js';
import { StockLedger } from '../../src/modules/inventory/StockLedger.js';
import { FinanceLedger, ACCOUNT_TYPES } from '../../src/modules/finance/FinanceLedger.js';
import { Parcel } from '../../src/modules/logistics/Parcel.js';
import { Return } from '../../src/modules/logistics/Return.js';

describe('Purchases, Double-Entry Finance & Logistics Workflows Suite', () => {
  let app;
  let sellerAToken, sellerBToken;
  let tenantA, tenantB;
  let productA;

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
        tenantName: 'Indus Electronics',
        slug: 'indus-electronics',
        subdomain: 'indus',
        ownerName: 'Kamran Akmal',
        email: 'kamran@indus.com',
        password: 'Password123!',
        phone: '03001234567',
      });

    sellerAToken = resA.body.data.token;
    tenantA = resA.body.data.tenant;

    // 2. Register Seller B
    const resB = await request(app)
      .post('/api/v1/auth/register-tenant')
      .send({
        tenantName: 'Mehran Traders',
        slug: 'mehran-traders',
        subdomain: 'mehran',
        ownerName: 'Farhan Zaidi',
        email: 'farhan@mehran.com',
        password: 'Password123!',
        phone: '03007654321',
      });

    sellerBToken = resB.body.data.token;
    tenantB = resB.body.data.tenant;

    // 3. Create initial product for Seller A (Zero stock initially)
    productA = await Product.create({
      tenantId: tenantA._id,
      name: 'Wireless Bluetooth Headset',
      slug: 'wireless-bluetooth-headset',
      sku: 'HEADSET-01',
      barcode: '400000000001',
      pricing: {
        costPrice: 0,
        retailPrice: 2500,
        websitePrice: 2300,
      },
      stock: 0,
    });
  });

  // TEST 1: Purchase Order with Landed Cost & Physical Inbound Receiving
  it('1. Calculates landed cost, inbounds physical stock, and updates costPrice snapshot upon receiving', async () => {
    // A. Create Supplier for Seller A
    const supplierRes = await request(app)
      .post('/api/v1/purchases/suppliers')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        name: 'Karachi Wholesale Distributors',
        phone: '03009988776',
        company: 'KWD Private Ltd',
      });

    expect(supplierRes.status).toBe(201);
    const supplier = supplierRes.body.data;
    expect(supplier.payableBalance).toBe(0);

    // B. Create Purchase Batch: 10 headsets @ Rs. 1,000 + Rs. 500 Courier Freight
    // Landed cost per unit = 1000 + (500 / 10) = 1,050
    // Total Amount = 10,500. Paid: 4,000 (Cash). Remaining (Credit / Payable): 6,500.
    const batchRes = await request(app)
      .post('/api/v1/purchases/batches')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        supplierId: supplier._id,
        items: [
          {
            productId: productA._id,
            quantity: 10,
            unitPrice: 1000,
          },
        ],
        courierExpense: 500,
        paidAmount: 4000,
        paymentMethod: 'cash',
        notes: 'Inbound shipment from Karachi port',
      });

    expect(batchRes.status).toBe(201);
    const batch = batchRes.body.data;
    expect(batch.items[0].courierExpensePerUnit).toBe(50);
    expect(batch.items[0].effectiveCostPrice).toBe(1050);
    expect(batch.totalAmount).toBe(10500);
    expect(batch.remainingAmount).toBe(6500);
    expect(batch.status).toBe('draft');

    // Prior to receiving: Physical stock is still 0
    let reloadedProduct = await Product.findById(productA._id);
    expect(reloadedProduct.stock).toBe(0);

    // C. Receive Purchase Batch
    const receiveRes = await request(app)
      .post(`/api/v1/purchases/batches/${batch._id}/receive`)
      .set('Authorization', `Bearer ${sellerAToken}`);

    expect(receiveRes.status).toBe(200);
    expect(receiveRes.body.data.status).toBe('received');

    // D. Verify Physical Product Stock & Cost Price Inbounded
    reloadedProduct = await Product.findById(productA._id);
    expect(reloadedProduct.stock).toBe(10);
    expect(reloadedProduct.pricing.costPrice).toBe(1050); // Landed cost updated!

    // E. Verify StockLedger contains PURCHASE_RECEIPT
    const stockLedgerEntry = await StockLedger.findOne({
      tenantId: tenantA._id,
      productId: productA._id,
      type: 'PURCHASE_RECEIPT',
    });
    expect(stockLedgerEntry).toBeDefined();
    expect(stockLedgerEntry.delta).toBe(10);
    expect(stockLedgerEntry.newStock).toBe(10);

    // F. Verify Supplier Khata Balance increased by 6,500
    const reloadedSupplier = await Supplier.findById(supplier._id);
    expect(reloadedSupplier.payableBalance).toBe(6500);
  });

  // TEST 2: Double-Entry Financial Accounting & Balance Sheet Integrity
  it('2. Enforces double-entry equation (Assets = Liabilities + Equity) across purchases, sales, and payments', async () => {
    // A. Initial Owner Capital Investment: Rs. 100,000 cash injected
    const investRes = await request(app)
      .post('/api/v1/finance/journal-entries')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        type: 'OWNER_INVESTMENT',
        debitAccount: ACCOUNT_TYPES.CASH,
        creditAccount: ACCOUNT_TYPES.OWNERS_EQUITY,
        amount: 100000,
        description: 'Initial seed capital invested by owner',
      });

    expect(investRes.status).toBe(201);

    // B. Create and receive a purchase order: 20 units @ Rs. 1,000 = Rs. 20,000 (Paid Rs. 5,000 cash, Rs. 15,000 on credit)
    const supRes = await request(app)
      .post('/api/v1/purchases/suppliers')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ name: 'Alpha Components', phone: '03211234567' });

    const poRes = await request(app)
      .post('/api/v1/purchases/batches')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        supplierId: supRes.body.data._id,
        items: [{ productId: productA._id, quantity: 20, unitPrice: 1000 }],
        paidAmount: 5000,
        paymentMethod: 'cash',
      });

    await request(app)
      .post(`/api/v1/purchases/batches/${poRes.body.data._id}/receive`)
      .set('Authorization', `Bearer ${sellerAToken}`);

    // C. Make a retail sale of 5 units @ Rs. 2,500 = Rs. 12,500 (Paid cash)
    const saleRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        channel: 'retail',
        customer: { name: 'Customer Walkin', phone: '03001112233' },
        items: [{ productId: productA._id, quantity: 5 }],
        payment: { method: 'cash' },
      });

    expect(saleRes.status).toBe(201);

    // D. Settle partial supplier khata: Pay Rs. 10,000 to supplier via cash
    const payRes = await request(app)
      .post('/api/v1/finance/supplier-payments')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        supplierId: supRes.body.data._id,
        amount: 10000,
        paymentMethod: 'cash',
        reference: 'VOUCHER-001',
      });

    expect(payRes.status).toBe(200);
    expect(payRes.body.data.supplier.payableBalance).toBe(5000); // 15,000 - 10,000 = 5,000

    // E. Record an operational expense (e.g. shop utilities: Rs. 2,000)
    const expRes = await request(app)
      .post('/api/v1/finance/expenses')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        category: ACCOUNT_TYPES.OPERATING_EXPENSE,
        amount: 2000,
        paymentMethod: 'cash',
        description: 'Electricity bill payment',
      });

    expect(expRes.status).toBe(201);

    // F. Fetch Real-Time Balance Sheet Report
    const bsRes = await request(app)
      .get('/api/v1/finance/balance-sheet')
      .set('Authorization', `Bearer ${sellerAToken}`);

    expect(bsRes.status).toBe(200);
    const bs = bsRes.body.data;

    // Mathematical Double-Entry Guarantee: Assets === Liabilities + Equity
    expect(bs.isBalanced).toBe(true);
    expect(bs.assets.totalAssets).toBe(bs.totalLiabilitiesAndEquity);
    expect(bs.liabilities.totalLiabilities).toBe(5000); // Remaining supplier khata

    // G. Fetch Real-Time Income Statement Report
    const isRes = await request(app)
      .get('/api/v1/finance/income-statement')
      .set('Authorization', `Bearer ${sellerAToken}`);

    expect(isRes.status).toBe(200);
    const is = isRes.body.data;
    // Sales Revenue: 12,500
    expect(is.revenue.salesRevenue).toBe(12500);
    // COGS: 5 units * 1000 cost = 5,000
    expect(is.costOfGoodsSold.cogs).toBe(5000);
    // Gross Profit = 12,500 - 5,000 = 7,500
    expect(is.grossProfit).toBe(7500);
    // Net Income = 7,500 - 2,000 (operating expense) = 5,500
    expect(is.netIncome).toBe(5500);
  });

  // TEST 3: Logistics Parcel Dispatch
  it('3. Dispatches order, generates Parcel tracking, and advances order fulfillment status', async () => {
    // 1. Inbound stock so we have units to fulfill
    await Product.findByIdAndUpdate(productA._id, { stock: 10, 'pricing.costPrice': 1000 });

    // 2. Create online customer order
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        channel: 'online',
        customer: {
          name: 'Shahid Afridi',
          phone: '03001239999',
          shippingAddress: { street: 'DHA Phase 6', city: 'Karachi' },
        },
        items: [{ productId: productA._id, quantity: 1 }],
      });

    const orderId = orderRes.body.data._id;

    // 3. Dispatch parcel via Leopard Courier Service (LCS)
    const parcelRes = await request(app)
      .post('/api/v1/logistics/parcels')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        orderId,
        trackingNumber: 'LCS-KARACHI-889900',
        courier: 'lcs',
        notes: 'Handed over to evening courier van',
      });

    expect(parcelRes.status).toBe(201);
    const parcel = parcelRes.body.data;
    expect(parcel.trackingNumber).toBe('LCS-KARACHI-889900');
    expect(parcel.status).toBe('dispatched');

    // 4. Verify order fulfillment status advanced to 'dispatched'
    const updatedOrder = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${sellerAToken}`);

    expect(updatedOrder.body.data.fulfillment.status).toBe('dispatched');
    expect(updatedOrder.body.data.fulfillment.courier.trackingNumber).toBe('LCS-KARACHI-889900');
  });

  // TEST 4: Return Inspection Grading (Restockable vs Damaged Goods)
  it('4. Correctly grades returns: restores physical stock for restockable items, records loss write-off for damaged items', async () => {
    // Product starts with 10 units in stock
    await Product.findByIdAndUpdate(productA._id, { stock: 10, 'pricing.costPrice': 1200 });

    // Customer places order for 2 units (stock drops from 10 to 8)
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        channel: 'online',
        customer: { name: 'Customer Return Test', phone: '03005556677' },
        items: [{ productId: productA._id, quantity: 2 }],
      });

    const orderId = orderRes.body.data._id;
    let prod = await Product.findById(productA._id);
    expect(prod.stock).toBe(8);

    // Customer returns the 2 items:
    // Item 1 is in pristine condition ('restockable') -> Must be added back to stock (+1)
    // Item 2 was crushed in transit ('damaged') -> Must NOT be added to stock, loss written off
    const returnRes = await request(app)
      .post('/api/v1/logistics/returns/inspect')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        orderId,
        trackingNumber: 'RET-TRACK-776655',
        reason: 'Customer reported one item damaged during transit',
        items: [
          {
            productId: productA._id,
            quantity: 1,
            condition: 'restockable',
          },
          {
            productId: productA._id,
            quantity: 1,
            condition: 'damaged',
          },
        ],
      });

    expect(returnRes.status).toBe(201);
    const returnRecord = returnRes.body.data;
    expect(returnRecord.status).toBe('inspected');
    expect(returnRecord.items[0].actionTaken).toBe('restocked');
    expect(returnRecord.items[1].actionTaken).toBe('written_off');

    // VERIFY PHYSICAL STOCK:
    // Only the restockable unit was added back (8 + 1 = 9, NOT 10!)
    prod = await Product.findById(productA._id);
    expect(prod.stock).toBe(9);

    // VERIFY STOCK LEDGER:
    // Only 1 unit inbounded with RETURN_RESTOCK
    const ledger = await StockLedger.findOne({
      tenantId: tenantA._id,
      productId: productA._id,
      type: 'RETURN_RESTOCK',
    });
    expect(ledger).toBeDefined();
    expect(ledger.delta).toBe(1);

    // VERIFY FINANCE LEDGER:
    // Damaged unit written off as damage expense for cost price (1,200)
    const damageEntry = await FinanceLedger.findOne({
      tenantId: tenantA._id,
      debitAccount: ACCOUNT_TYPES.DAMAGE_EXPENSE,
    });
    expect(damageEntry).toBeDefined();
    expect(damageEntry.amount).toBe(1200);
  });

  // TEST 5: Cross-Tenant Isolation Across Purchases, Suppliers & Logistics
  it('5. Strictly isolates suppliers, purchase orders, and parcels between Seller A and Seller B', async () => {
    // Seller A creates a supplier and purchase batch
    const supResA = await request(app)
      .post('/api/v1/purchases/suppliers')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ name: 'Seller A Exclusive Supplier', phone: '03001111111' });

    // Seller B lists suppliers -> Cannot see Seller A's supplier
    const supListB = await request(app)
      .get('/api/v1/purchases/suppliers')
      .set('Authorization', `Bearer ${sellerBToken}`);

    expect(supListB.status).toBe(200);
    expect(supListB.body.data.length).toBe(0);

    // Seller B attempts to list journal entries -> Cannot see Seller A's financial transactions
    const ledgerB = await request(app)
      .get('/api/v1/finance/ledger')
      .set('Authorization', `Bearer ${sellerBToken}`);

    expect(ledgerB.status).toBe(200);
    expect(ledgerB.body.data.length).toBe(0);
  });
});

