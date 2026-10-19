import mongoose from 'mongoose';
import { Product } from '../products/Product.js';
import { StockLedger } from './StockLedger.js';

export class InsufficientStockError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'InsufficientStockError';
    this.code = 'INSUFFICIENT_STOCK';
    this.status = 400;
    this.details = details;
  }
}

/**
 * 1. Atomically deduct stock for a single item with strict stock guard
 */
export const deductSingleItemStock = async ({
  tenantId,
  productId,
  quantity,
  type = 'SALE_DEDUCTION',
  referenceModel,
  referenceId,
  idempotencyKey,
  actorId,
  reason,
}) => {
  const numQty = Number(quantity);
  if (!Number.isFinite(numQty) || numQty <= 0) {
    throw new Error('Quantity must be a positive number');
  }

  // Idempotency check: if already processed for this key, return existing
  if (idempotencyKey) {
    const existing = await StockLedger.findOne({
      tenantId,
      idempotencyKey: String(idempotencyKey).trim(),
    });
    if (existing) {
      return { ledger: existing, alreadyProcessed: true };
    }
  }

  // ATOMIC CONDITIONAL UPDATE:
  // Fails if stock < numQty or if tenantId does not match
  const updatedProduct = await Product.findOneAndUpdate(
    {
      _id: productId,
      tenantId,
      stock: { $gte: numQty },
    },
    {
      $inc: { stock: -numQty },
    },
    { new: true }
  );

  if (!updatedProduct) {
    // Determine if product is missing or simply out of stock
    const product = await Product.findOne({ _id: productId, tenantId });
    if (!product) {
      throw new Error(`Product ${productId} not found in this store`);
    }
    throw new InsufficientStockError(
      `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${numQty}`,
      {
        productId,
        productName: product.name,
        available: product.stock,
        requested: numQty,
      }
    );
  }

  const newStock = updatedProduct.stock;
  const previousStock = newStock + numQty;

  // Record immutable ledger entry
  const ledger = new StockLedger({
    tenantId,
    productId,
    type,
    delta: -numQty,
    quantity: numQty,
    previousStock,
    newStock,
    reason: reason || `${type} for ${referenceModel} #${referenceId}`,
    referenceModel,
    referenceId: String(referenceId),
    idempotencyKey: idempotencyKey ? String(idempotencyKey).trim() : undefined,
    actorId,
  });

  await ledger.save();

  return { product: updatedProduct, ledger, alreadyProcessed: false };
};

/**
 * 2. Atomically deduct stock for multiple items in an order
 * Includes automatic compensating rollback if any item lacks stock
 */
export const batchDeductStock = async ({
  tenantId,
  items, // [{ productId, quantity }]
  type = 'SALE_DEDUCTION',
  referenceModel,
  referenceId,
  idempotencyKey,
  actorId,
  reason,
}) => {
  // Check idempotency first
  if (idempotencyKey) {
    const existing = await StockLedger.find({
      tenantId,
      idempotencyKey: String(idempotencyKey).trim(),
    });
    if (existing.length > 0) {
      return { ledgers: existing, alreadyProcessed: true };
    }
  }

  const decremented = [];

  try {
    const ledgers = [];

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const qty = Number(item.quantity);
      if (qty <= 0) continue;

      const pId = item.productId || item._id;

      // Conditional atomic decrement
      const updated = await Product.findOneAndUpdate(
        {
          _id: pId,
          tenantId,
          stock: { $gte: qty },
        },
        {
          $inc: { stock: -qty },
        },
        { new: true }
      );

      if (!updated) {
        // Find product for clear error
        const currentProd = await Product.findOne({ _id: pId, tenantId });
        const available = currentProd ? currentProd.stock : 0;
        const prodName = currentProd ? currentProd.name : 'Unknown Product';

        // COMPENSATING ROLLBACK: Revert all previously decremented items
        for (const dec of decremented) {
          try {
            await Product.findOneAndUpdate(
              { _id: dec.productId, tenantId },
              { $inc: { stock: dec.quantity } }
            );
          } catch (rbErr) {
            console.error('Critical Rollback Failure:', rbErr);
          }
        }

        throw new InsufficientStockError(
          `Insufficient stock for "${prodName}". Available: ${available}, Requested: ${qty}`,
          {
            productId: pId,
            productName: prodName,
            available,
            requested: qty,
          }
        );
      }

      decremented.push({
        productId: updated._id,
        quantity: qty,
        previousStock: updated.stock + qty,
        newStock: updated.stock,
      });

      // Item idempotency key
      const lineIdempotencyKey = idempotencyKey ? `${idempotencyKey}-line-${index}` : undefined;

      const ledger = new StockLedger({
        tenantId,
        productId: updated._id,
        type,
        delta: -qty,
        quantity: qty,
        previousStock: updated.stock + qty,
        newStock: updated.stock,
        reason: reason || `${type} for ${referenceModel} #${referenceId}`,
        referenceModel,
        referenceId: String(referenceId),
        idempotencyKey: lineIdempotencyKey,
        actorId,
      });

      await ledger.save();
      ledgers.push(ledger);
    }

    return { ledgers, alreadyProcessed: false };
  } catch (err) {
    throw err;
  }
};

/**
 * 3. Restore stock (Order cancellation, returns, releases)
 */
export const restoreStock = async ({
  tenantId,
  items, // [{ productId, quantity }]
  type = 'STOCK_RELEASE',
  referenceModel,
  referenceId,
  actorId,
  reason,
}) => {
  const ledgers = [];

  for (const item of items) {
    const qty = Number(item.quantity);
    if (qty <= 0) continue;

    const pId = item.productId || item._id;

    const updated = await Product.findOneAndUpdate(
      { _id: pId, tenantId },
      { $inc: { stock: qty } },
      { new: true }
    );

    if (updated) {
      const ledger = new StockLedger({
        tenantId,
        productId: updated._id,
        type,
        delta: qty,
        quantity: qty,
        previousStock: updated.stock - qty,
        newStock: updated.stock,
        reason: reason || `${type} for ${referenceModel} #${referenceId}`,
        referenceModel,
        referenceId: String(referenceId),
        actorId,
      });

      await ledger.save();
      ledgers.push(ledger);
    }
  }

  return ledgers;
};

/**
 * 4. Manual Stock Adjustment with Audit
 */
export const adjustStock = async ({
  tenantId,
  productId,
  newStock,
  reason,
  actorId,
  notes,
}) => {
  const targetStock = Number(newStock);
  if (!Number.isFinite(targetStock) || targetStock < 0) {
    throw new Error('New stock count must be a non-negative number');
  }

  const product = await Product.findOne({ _id: productId, tenantId });
  if (!product) {
    throw new Error('Product not found in this store');
  }

  const previousStock = product.stock;
  const delta = targetStock - previousStock;

  if (delta === 0) {
    return { product, changed: false };
  }

  product.stock = targetStock;
  await product.save();

  const ledger = new StockLedger({
    tenantId,
    productId: product._id,
    type: 'ADJUSTMENT',
    delta,
    quantity: Math.abs(delta),
    previousStock,
    newStock: targetStock,
    reason: reason || 'Manual stock reconciliation',
    referenceModel: 'Manual',
    referenceId: `ADJ-${Date.now()}`,
    actorId,
    notes,
  });

  await ledger.save();

  return { product, ledger, changed: true };
};
