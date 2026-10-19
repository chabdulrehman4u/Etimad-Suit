import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDb, clearTestDb, closeTestDb } from '../setup.js';
import { createApp } from '../../src/app.js';
import { Product } from '../../src/modules/products/Product.js';
import { StockLedger } from '../../src/modules/inventory/StockLedger.js';
import { FinanceLedger, ACCOUNT_TYPES } from '../../src/modules/finance/FinanceLedger.js';
import { CashierShift } from '../../src/modules/pos/CashierShift.js';
import { WholesaleCustomer } from '../../src/modules/wholesale/WholesaleCustomer.js';
import { Quotation } from '../../src/modules/wholesale/Quotation.js';

describe('Retail POS & Wholesale Workflows Suite', () => {
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
        tenantName: 'Metro Hypermarket',
        slug: 'metro-hypermarket',
        subdomain: 'metro',
        ownerName: 'Rashid Latif',
        email: 'rashid@metro.com',
        password: 'Password123!',
        phone: '03001234567',
      });

    sellerAToken = resA.body.data.token;
    tenantA = resA.body.data.tenant;

    // 2. Register Seller B
    const resB = await request(app)
      .post('/api/v1/auth/register-tenant')
      .send({
        tenantName: 'City Cash & Carry',
        slug: 'city-cash-carry',
        subdomain: 'city',
        ownerName: 'Noman Ali',
        email: 'noman@city.com',
        password: 'Password123!',
        phone: '03007654321',
      });

    sellerBToken = resB.body.data.token;
    tenantB = resB.body.data.tenant;

    // 3. Create Retail Product for Seller A (20 in stock)
    productA = await Product.create({
      tenantId: tenantA._id,
      name: 'Wireless Optical Mouse',
      slug: 'wireless-optical-mouse',
      sku: 'MOUSE-OPT-01',
      barcode: '8964000112233',
      pricing: {
        costPrice: 500,
        retailPrice: 1000,
        wholesalePrice: 750,
        minWholesaleQty: 5,
      },
      stock: 20,
    });

    // 4. Create Product for Seller B
    productB = await Product.create({
      tenantId: tenantB._id,
      name: 'Mechanical Gaming Keyboard',
      slug: 'mechanical-gaming-keyboard',
      sku: 'KB-MECH-01',
      barcode: '8964000998877',
      pricing: {
        costPrice: 2000,
        retailPrice: 4000,
      },
      stock: 10,
    });
  });

  // TEST 1: Rapid Barcode / SKU Scanner Lookup
  it('1. Instantly resolves product by barcode or SKU for POS counters', async () => {
    // A. Lookup by barcode
    const barcodeRes = await request(app)
      .get('/api/v1/pos/lookup?code=8964000112233')
      .set('Authorization', `Bearer ${sellerAToken}`);

    expect(barcodeRes.status).toBe(200);
    expect(barcodeRes.body.data.name).toBe('Wireless Optical Mouse');
    expect(barcodeRes.body.data.price).toBe(1000);
    expect(barcodeRes.body.data.stock).toBe(20);

    // B. Lookup by SKU
    const skuRes = await request(app)
      .get('/api/v1/pos/lookup?code=MOUSE-OPT-01')
      .set('Authorization', `Bearer ${sellerAToken}`);

    expect(skuRes.status).toBe(200);
    expect(skuRes.body.data.productId).toBe(productA._id.toString());
  });

  // TEST 2: Cashier Shifts & End-of-Day Drawer Reconciliation
  it('2. Tracks cashier shifts, accrues sales, and calculates drawer reconciliation differences', async () => {
    // 1. Open shift with Rs. 5,000 opening cash
    const openRes = await request(app)
      .post('/api/v1/pos/shifts/open')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        openingCash: 5000,
        registerId: 'POS-COUNTER-1',
      });

    expect(openRes.status).toBe(201);
    const shiftId = openRes.body.data._id;
    expect(openRes.body.data.openingCash).toBe(5000);
    expect(openRes.body.data.expectedCash).toBe(5000);
    expect(openRes.body.data.status).toBe('open');

    // 2. Perform POS cash sale of 2 units (2 * 1,000 = Rs. 2,000 cash)
    const saleRes = await request(app)
      .post('/api/v1/pos/sales')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        shiftId,
        items: [{ productId: productA._id, quantity: 2 }],
        payment: { method: 'cash', cashTendered: 2000, cashPaid: 2000 },
      });

    expect(saleRes.status).toBe(201);

    // 3. Verify current shift metrics accrued
    const currentShiftRes = await request(app)
      .get('/api/v1/pos/shifts/current')
      .set('Authorization', `Bearer ${sellerAToken}`);

    expect(currentShiftRes.status).toBe(200);
    expect(currentShiftRes.body.data.totalSalesCount).toBe(1);
    expect(currentShiftRes.body.data.totalCashSales).toBe(2000);
    expect(currentShiftRes.body.data.expectedCash).toBe(7000); // 5000 opening + 2000 sale

    // 4. Close shift and reconcile cash drawer
    // Cashier counted Rs. 6,950 in drawer (Rs. 50 shortage)
    const closeRes = await request(app)
      .post(`/api/v1/pos/shifts/${shiftId}/close`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        actualCash: 6950,
        closingNotes: 'Shortage of Rs. 50 due to change discrepancy',
      });

    expect(closeRes.status).toBe(200);
    expect(closeRes.body.data.status).toBe('closed');
    const rec = closeRes.body.reconciliation;
    expect(rec.expectedCash).toBe(7000);
    expect(rec.actualCash).toBe(6950);
    expect(rec.cashDifference).toBe(-50); // Rs. 50 shortage
    expect(rec.hasShortage).toBe(true);
    expect(rec.isBalanced).toBe(false);
  });

  // TEST 3: POS Sale with Split Payment & Instant Stock/Finance Sync
  it('3. Processes POS split payment (Cash + Card), updates physical stock, and records double-entry financials', async () => {
    // Product starts with 20 units
    let prod = await Product.findById(productA._id);
    expect(prod.stock).toBe(20);

    // Sale of 4 units @ Rs. 1,000 = Rs. 4,000
    // Split Payment: Rs. 2,500 Cash + Rs. 1,500 Card
    const saleRes = await request(app)
      .post('/api/v1/pos/sales')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        customer: { name: 'Ali Ahmed', phone: '03009988776' },
        items: [{ productId: productA._id, quantity: 4 }],
        payment: {
          method: 'split',
          cashPaid: 2500,
          cardPaid: 1500,
        },
      });

    expect(saleRes.status).toBe(201);
    expect(saleRes.body.data.financials.grandTotal).toBe(4000);
    expect(saleRes.body.receipt).toBeDefined();
    expect(saleRes.body.receipt.storeName).toBe('Metro Hypermarket');
    expect(saleRes.body.receipt.paymentMethod).toBe('split');

    // VERIFY PHYSICAL STOCK DECREMENTED:
    // 20 - 4 = 16 units remaining
    prod = await Product.findById(productA._id);
    expect(prod.stock).toBe(16);

    // VERIFY STOCK LEDGER:
    const ledger = await StockLedger.findOne({
      tenantId: tenantA._id,
      productId: productA._id,
      type: 'SALE_DEDUCTION',
      quantity: 4,
    });
    expect(ledger).toBeDefined();
    expect(ledger.delta).toBe(-4);
    expect(ledger.newStock).toBe(16);

    // VERIFY DOUBLE-ENTRY FINANCE LEDGER:
    // Revenue of Rs. 4,000 recognized
    const revenueEntries = await FinanceLedger.find({
      tenantId: tenantA._id,
      creditAccount: ACCOUNT_TYPES.SALES_REVENUE,
    });
    const totalRev = revenueEntries.reduce((s, e) => s + e.amount, 0);
    expect(totalRev).toBe(4000);

    // COGS recognized for 4 units * 500 cost = Rs. 2,000
    const cogsEntry = await FinanceLedger.findOne({
      tenantId: tenantA._id,
      debitAccount: ACCOUNT_TYPES.COGS,
    });
    expect(cogsEntry).toBeDefined();
    expect(cogsEntry.amount).toBe(2000);
  });

  // TEST 4: Wholesale Quotations & Order Conversion with Credit Limit Enforcement
  it('4. Generates wholesale quotations and strictly enforces credit limits during order conversion', async () => {
    // 1. Create Wholesale Customer with Rs. 20,000 credit limit
    const customerRes = await request(app)
      .post('/api/v1/wholesale/customers')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        name: 'Punjab Tech Resellers',
        companyName: 'PTR Private Ltd',
        phone: '03214455667',
        creditLimit: 20000,
        creditTermsDays: 15,
      });

    expect(customerRes.status).toBe(201);
    const customerId = customerRes.body.data._id;
    expect(customerRes.body.data.creditLimit).toBe(20000);
    expect(customerRes.body.data.outstandingBalance).toBe(0);

    // Inbound stock so we have units for wholesale
    await Product.findByIdAndUpdate(productA._id, { stock: 50, 'pricing.costPrice': 500, 'pricing.wholesalePrice': 750 });

    // 2. Create Quotation 1: 15 units @ Rs. 750 = Rs. 11,250
    const q1Res = await request(app)
      .post('/api/v1/wholesale/quotations')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        customerId,
        items: [{ productId: productA._id, quantity: 15, unitPrice: 750 }],
        validDays: 14,
      });

    expect(q1Res.status).toBe(201);
    const q1Id = q1Res.body.data._id;
    expect(q1Res.body.data.grandTotal).toBe(11250);

    // 3. Convert Quotation 1 on Credit (Rs. 11,250 <= Rs. 20,000 limit -> Allowed!)
    const conv1Res = await request(app)
      .post(`/api/v1/wholesale/quotations/${q1Id}/convert`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ paymentMethod: 'credit', amountPaid: 0 });

    expect(conv1Res.status).toBe(200);
    expect(conv1Res.body.data.quotation.status).toBe('converted');

    // Customer khata now has Rs. 11,250 debt
    let reloadedCustomer = await WholesaleCustomer.findById(customerId);
    expect(reloadedCustomer.outstandingBalance).toBe(11250);

    // 4. Create Quotation 2: 15 units @ Rs. 750 = Rs. 11,250
    // Attempting to convert this on credit would push debt to 11,250 + 11,250 = Rs. 22,500 (> Rs. 20,000 limit!)
    const q2Res = await request(app)
      .post('/api/v1/wholesale/quotations')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        customerId,
        items: [{ productId: productA._id, quantity: 15, unitPrice: 750 }],
        validDays: 14,
      });

    const q2Id = q2Res.body.data._id;

    // 5. Attempt Conversion on Credit -> MUST BE REJECTED!
    const conv2FailRes = await request(app)
      .post(`/api/v1/wholesale/quotations/${q2Id}/convert`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ paymentMethod: 'credit', amountPaid: 0 });

    expect(conv2FailRes.status).toBe(400);
    expect(conv2FailRes.body.error.code).toBe('CONVERSION_FAILED');
    expect(conv2FailRes.body.error.message).toContain('Credit limit exceeded');

    // Customer balance remains unchanged at 11,250
    reloadedCustomer = await WholesaleCustomer.findById(customerId);
    expect(reloadedCustomer.outstandingBalance).toBe(11250);
  });

  // TEST 5: Wholesale Customer Khata Payment & Balance Reduction
  it('5. Records wholesale customer khata payments and reduces live accounts receivable', async () => {
    // 1. Create Customer with outstanding balance of Rs. 15,000
    const customer = await WholesaleCustomer.create({
      tenantId: tenantA._id,
      name: 'Lahore Mobile Traders',
      phone: '03331234567',
      creditLimit: 50000,
      outstandingBalance: 15000,
    });

    // 2. Customer pays Rs. 10,000 via bank transfer to settle partial khata
    const payRes = await request(app)
      .post(`/api/v1/wholesale/customers/${customer._id}/payments`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({
        amount: 10000,
        paymentMethod: 'bank',
        reference: 'HBL-FT-998811',
      });

    expect(payRes.status).toBe(200);
    expect(payRes.body.data.customer.outstandingBalance).toBe(5000); // 15,000 - 10,000 = 5,000

    // Verify in database
    const reloaded = await WholesaleCustomer.findById(customer._id);
    expect(reloaded.outstandingBalance).toBe(5000);

    // Verify Double-Entry Journal: Debit Bank Rs. 10,000, Credit Accounts Receivable Rs. 10,000
    const entry = await FinanceLedger.findOne({
      tenantId: tenantA._id,
      type: 'CUSTOMER_PAYMENT',
      referenceId: customer._id.toString(),
    });
    expect(entry).toBeDefined();
    expect(entry.amount).toBe(10000);
    expect(entry.debitAccount).toBe(ACCOUNT_TYPES.BANK);
    expect(entry.creditAccount).toBe(ACCOUNT_TYPES.ACCOUNTS_RECEIVABLE);
  });

  // TEST 6: Strict Multi-Tenant Isolation
  it('6. Strictly isolates POS shifts and wholesale customer accounts between Seller A and Seller B', async () => {
    // Seller A creates wholesale customer
    await WholesaleCustomer.create({
      tenantId: tenantA._id,
      name: 'Seller A Private Wholesale Client',
      phone: '03001119999',
    });

    // Seller B lists wholesale customers -> Sees 0
    const listB = await request(app)
      .get('/api/v1/wholesale/customers')
      .set('Authorization', `Bearer ${sellerBToken}`);

    expect(listB.status).toBe(200);
    expect(listB.body.data.length).toBe(0);

    // Seller B attempts to scan Seller A's barcode -> 404 NOT FOUND
    const scanB = await request(app)
      .get(`/api/v1/pos/lookup?code=${productA.barcode}`)
      .set('Authorization', `Bearer ${sellerBToken}`);

    expect(scanB.status).toBe(404);
  });
});

