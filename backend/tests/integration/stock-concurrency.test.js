import mongoose from 'mongoose';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { connectTestDb, clearTestDb, closeTestDb } from '../setup.js';
import { createApp } from '../../src/app.js';
import { Product } from '../../src/modules/products/Product.js';
import { Tenant } from '../../src/modules/tenants/Tenant.js';
import { StockLedger } from '../../src/modules/inventory/StockLedger.js';
import {
  deductSingleItemStock,
  batchDeductStock,
  restoreStock,
  adjustStock,
  InsufficientStockError,
} from '../../src/modules/inventory/inventoryService.js';

describe('Inventory Integrity & Stock Concurrency Suite', () => {
  let tenant;

  beforeAll(async () => {
    await connectTestDb();
  }, 180000);

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // Create a tenant
    tenant = await Tenant.create({
      name: 'Inventory Test Store',
      slug: 'inventory-test',
      subdomain: 'inventory-test',
      ownerId: new mongoose.Types.ObjectId(),
    });
  });

  // TEST 1: 20 Concurrent Deductions Competing for 5 Units
  it('1. Prevents overselling under high concurrency (20 simultaneous requests for 5 items)', async () => {
    // Product with exactly 5 units in stock
    const product = await Product.create({
      tenantId: tenant._id,
      name: 'Limited Edition Smartwatch',
      slug: 'limited-edition-smartwatch',
      sku: 'WATCH-LTD-01',
      barcode: '200000000001',
      pricing: { retailPrice: 15000 },
      stock: 5,
    });

    const totalRequests = 20;
    const promises = [];

    // Launch 20 concurrent deduction attempts simultaneously
    for (let i = 0; i < totalRequests; i++) {
      promises.push(
        deductSingleItemStock({
          tenantId: tenant._id,
          productId: product._id,
          quantity: 1,
          type: 'SALE_DEDUCTION',
          referenceModel: 'Order',
          referenceId: `CONCUR-ORD-${i}`,
          idempotencyKey: `concur-key-${i}`,
          reason: `Concurrent purchase test ${i}`,
        })
          .then((res) => ({ status: 'fulfilled', value: res }))
          .catch((err) => ({ status: 'rejected', reason: err }))
      );
    }

    const results = await Promise.all(promises);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly 5 must succeed
    expect(fulfilled.length).toBe(5);
    // Exactly 15 must fail
    expect(rejected.length).toBe(15);

    // All rejections must be InsufficientStockError
    for (const rej of rejected) {
      expect(rej.reason).toBeInstanceOf(InsufficientStockError);
      expect(rej.reason.code).toBe('INSUFFICIENT_STOCK');
    }

    // Verify final database state: Stock must be exactly 0, NEVER negative
    const finalProduct = await Product.findById(product._id);
    expect(finalProduct.stock).toBe(0);

    // Verify StockLedger audit trail: Exactly 5 ledger records created
    const ledgerEntries = await StockLedger.find({
      tenantId: tenant._id,
      productId: product._id,
    }).sort({ createdAt: 1 });

    expect(ledgerEntries.length).toBe(5);

    // Verify each ledger entry has delta -1 and valid stock transitions
    for (const entry of ledgerEntries) {
      expect(entry.delta).toBe(-1);
      expect(entry.quantity).toBe(1);
      expect(entry.type).toBe('SALE_DEDUCTION');
      expect(entry.previousStock - entry.newStock).toBe(1);
    }
  });

  // TEST 2: Multi-Item Batch Deduction with Compensating Rollback
  it('2. Performs atomic compensating rollback if any item in a batch lacks stock', async () => {
    // Product 1: Has plenty of stock (10)
    const productAvailable = await Product.create({
      tenantId: tenant._id,
      name: 'Mechanical Keyboard',
      slug: 'mechanical-keyboard',
      sku: 'KB-01',
      barcode: '200000000002',
      pricing: { retailPrice: 5000 },
      stock: 10,
    });

    // Product 2: Has only 1 in stock
    const productScarce = await Product.create({
      tenantId: tenant._id,
      name: 'Rare Artisan Keycap',
      slug: 'rare-artisan-keycap',
      sku: 'KEYCAP-RARE',
      barcode: '200000000003',
      pricing: { retailPrice: 3000 },
      stock: 1,
    });

    // Attempt to buy: 2 keyboards (available) AND 3 keycaps (only 1 available -> will fail)
    await expect(
      batchDeductStock({
        tenantId: tenant._id,
        items: [
          { productId: productAvailable._id, quantity: 2 },
          { productId: productScarce._id, quantity: 3 },
        ],
        type: 'SALE_DEDUCTION',
        referenceModel: 'Order',
        referenceId: 'BATCH-ORD-FAIL',
        idempotencyKey: 'batch-test-fail-key',
        reason: 'Multi-item checkout test',
      })
    ).rejects.toThrow(InsufficientStockError);

    // VERIFY COMPENSATING ROLLBACK:
    // Product 1 must be reverted back to 10 (not decremented to 8!)
    const reloadedAvailable = await Product.findById(productAvailable._id);
    expect(reloadedAvailable.stock).toBe(10);

    // Product 2 remains untouched at 1
    const reloadedScarce = await Product.findById(productScarce._id);
    expect(reloadedScarce.stock).toBe(1);
  });

  // TEST 3: Idempotency Key Prevents Duplicate Decrements
  it('3. Guarantees idempotency — retrying with identical key does not double-decrement', async () => {
    const product = await Product.create({
      tenantId: tenant._id,
      name: 'USB-C Fast Charger 65W',
      slug: 'usbc-fast-charger-65w',
      sku: 'CHARGER-65W',
      barcode: '200000000004',
      pricing: { retailPrice: 3500 },
      stock: 20,
    });

    const idempotencyKey = 'unique-payment-intent-999';

    // First attempt: succeeds
    const firstResult = await deductSingleItemStock({
      tenantId: tenant._id,
      productId: product._id,
      quantity: 2,
      type: 'SALE_DEDUCTION',
      referenceModel: 'Order',
      referenceId: 'ORD-IDEMPOTENT-01',
      idempotencyKey,
      reason: 'First checkout attempt',
    });

    expect(firstResult.alreadyProcessed).toBe(false);
    expect(firstResult.product.stock).toBe(18);

    // Second attempt with exact same idempotencyKey (network retry simulation)
    const secondResult = await deductSingleItemStock({
      tenantId: tenant._id,
      productId: product._id,
      quantity: 2,
      type: 'SALE_DEDUCTION',
      referenceModel: 'Order',
      referenceId: 'ORD-IDEMPOTENT-01',
      idempotencyKey,
      reason: 'Network retry checkout attempt',
    });

    expect(secondResult.alreadyProcessed).toBe(true);

    // Verify stock was ONLY decremented once
    const reloadedProduct = await Product.findById(product._id);
    expect(reloadedProduct.stock).toBe(18);

    // Verify only 1 ledger entry exists for this idempotency key
    const ledgerCount = await StockLedger.countDocuments({
      tenantId: tenant._id,
      idempotencyKey,
    });
    expect(ledgerCount).toBe(1);
  });

  // TEST 4: Stock Restoration on Cancellation
  it('4. Restores stock and creates STOCK_RELEASE ledger entry on cancellation', async () => {
    const product = await Product.create({
      tenantId: tenant._id,
      name: 'Ergonomic Desk Mat',
      slug: 'ergonomic-desk-mat',
      sku: 'MAT-01',
      barcode: '200000000005',
      pricing: { retailPrice: 1500 },
      stock: 15,
    });

    // 1. Deduct 3 units
    await deductSingleItemStock({
      tenantId: tenant._id,
      productId: product._id,
      quantity: 3,
      referenceModel: 'Order',
      referenceId: 'ORD-RESTORE-01',
    });

    let reloaded = await Product.findById(product._id);
    expect(reloaded.stock).toBe(12);

    // 2. Cancel order and restore 3 units
    const restoredLedgers = await restoreStock({
      tenantId: tenant._id,
      items: [{ productId: product._id, quantity: 3 }],
      type: 'STOCK_RELEASE',
      referenceModel: 'Order',
      referenceId: 'ORD-RESTORE-01',
      reason: 'Customer cancelled order #ORD-RESTORE-01',
    });

    expect(restoredLedgers.length).toBe(1);
    expect(restoredLedgers[0].type).toBe('STOCK_RELEASE');
    expect(restoredLedgers[0].delta).toBe(3);

    // Physical stock restored to 15
    reloaded = await Product.findById(product._id);
    expect(reloaded.stock).toBe(15);
  });

  // TEST 5: Manual Stock Adjustment with Audit
  it('5. Adjusts stock and logs ADJUSTMENT with actor audit trail', async () => {
    const product = await Product.create({
      tenantId: tenant._id,
      name: 'Wireless Mouse',
      slug: 'wireless-mouse',
      sku: 'MOUSE-01',
      barcode: '200000000006',
      pricing: { retailPrice: 1200 },
      stock: 25,
    });

    // Warehouse manager recounts and finds only 22 units (3 units damaged)
    const result = await adjustStock({
      tenantId: tenant._id,
      productId: product._id,
      newStock: 22,
      reason: 'Physical cycle count discrepancy - 3 units damaged',
      notes: 'Water damage during warehouse cleaning',
    });

    expect(result.changed).toBe(true);
    expect(result.product.stock).toBe(22);
    expect(result.ledger.type).toBe('ADJUSTMENT');
    expect(result.ledger.delta).toBe(-3);
    expect(result.ledger.previousStock).toBe(25);
    expect(result.ledger.newStock).toBe(22);

    const reloaded = await Product.findById(product._id);
    expect(reloaded.stock).toBe(22);
  });
});
