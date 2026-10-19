import mongoose from 'mongoose';
import { PurchaseBatch } from './PurchaseBatch.js';
import { Supplier } from './Supplier.js';
import { Product } from '../products/Product.js';
import { StockLedger } from '../inventory/StockLedger.js';
import { recordPurchaseFinancials } from '../finance/financeService.js';

export const generateBatchNumber = async (tenantId) => {
  const count = await PurchaseBatch.countDocuments({ tenantId });
  const sequence = String(count + 1).padStart(4, '0');
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `PO-${sequence}-${rand}`;
};

/**
 * 1. Create Purchase Batch with Landed Freight Cost Allocation
 */
export const createPurchaseBatch = async ({
  tenantId,
  supplierId,
  items, // [{ productId, quantity, unitPrice }]
  courierExpense = 0,
  paymentStatus = 'unpaid',
  paidAmount = 0,
  paymentMethod = 'cash',
  notes = '',
  actorId,
  idempotencyKey,
}) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Purchase order must contain at least one item');
  }

  // Verify supplier belongs to this tenant
  const supplier = await Supplier.findOne({ _id: supplierId, tenantId });
  if (!supplier) {
    throw new Error('Supplier not found in this store');
  }

  // Check idempotency
  if (idempotencyKey) {
    const existing = await PurchaseBatch.findOne({
      tenantId,
      idempotencyKey: String(idempotencyKey).trim(),
    });
    if (existing) {
      return { batch: existing, isDuplicate: true };
    }
  }

  // Landed Cost Allocation:
  // Allocate freight/courier expense evenly per unit across items
  const totalQuantity = items.reduce((sum, item) => sum + Math.max(1, parseInt(item.quantity, 10) || 1), 0);
  const numCourierExpense = Math.max(0, Number(courierExpense) || 0);
  const courierExpensePerUnit = totalQuantity > 0 ? Math.round((numCourierExpense / totalQuantity) * 100) / 100 : 0;

  let itemsCost = 0;
  const processedItems = [];

  for (const item of items) {
    const product = await Product.findOne({ _id: item.productId, tenantId });
    if (!product) {
      throw new Error(`Product ${item.productId} not found in this store`);
    }

    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
    const lineTotal = unitPrice * qty;
    const effectiveCostPrice = unitPrice + courierExpensePerUnit;

    itemsCost += lineTotal;

    processedItems.push({
      productId: product._id,
      name: product.name,
      sku: product.sku || '',
      quantity: qty,
      unitPrice,
      courierExpensePerUnit,
      effectiveCostPrice,
      lineTotal,
    });
  }

  const totalAmount = itemsCost + numCourierExpense;
  const cleanPaidAmount = Math.min(totalAmount, Math.max(0, Number(paidAmount) || 0));
  const remainingAmount = Math.max(0, totalAmount - cleanPaidAmount);

  let calculatedPaymentStatus = paymentStatus;
  if (cleanPaidAmount >= totalAmount) {
    calculatedPaymentStatus = 'paid';
  } else if (cleanPaidAmount > 0) {
    calculatedPaymentStatus = 'partially_paid';
  } else {
    calculatedPaymentStatus = 'unpaid';
  }

  const batchNumber = await generateBatchNumber(tenantId);

  const batch = new PurchaseBatch({
    tenantId,
    batchNumber,
    supplierId: supplier._id,
    supplierName: supplier.name,
    items: processedItems,
    itemsCost,
    courierExpense: numCourierExpense,
    totalAmount,
    paymentStatus: calculatedPaymentStatus,
    paidAmount: cleanPaidAmount,
    remainingAmount,
    paymentMethod,
    status: 'draft',
    idempotencyKey: idempotencyKey ? String(idempotencyKey).trim() : undefined,
    notes,
    createdById: actorId,
  });

  await batch.save();
  return { batch, isDuplicate: false };
};

/**
 * 2. Receive Purchase Batch (Inbounds Stock & Triggers Double-Entry Finance)
 */
export const receivePurchaseBatch = async ({ tenantId, batchId, actorId }) => {
  const batch = await PurchaseBatch.findOne({ _id: batchId, tenantId });
  if (!batch) {
    throw new Error('Purchase batch not found in this store');
  }

  if (batch.status === 'received') {
    throw new Error('This purchase batch has already been received');
  }

  if (batch.status === 'cancelled') {
    throw new Error('Cancelled purchase batches cannot be received');
  }

  // 1. Inbound Physical Stock into Product & Record in StockLedger
  for (const item of batch.items) {
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: item.productId, tenantId },
      {
        $inc: { stock: item.quantity },
        $set: { 'pricing.costPrice': item.effectiveCostPrice },
      },
      { new: true }
    );

    if (updatedProduct) {
      const ledger = new StockLedger({
        tenantId,
        productId: item.productId,
        type: 'PURCHASE_RECEIPT',
        delta: item.quantity,
        quantity: item.quantity,
        previousStock: updatedProduct.stock - item.quantity,
        newStock: updatedProduct.stock,
        reason: `Purchase Receipt #${batch.batchNumber} from ${batch.supplierName}`,
        referenceModel: 'PurchaseBatch',
        referenceId: batch.batchNumber,
        actorId,
      });

      await ledger.save();
    }
  }

  // 2. Double-Entry Financial Integration:
  // Debits Inventory, Credits Cash/Bank and Accounts Payable
  await recordPurchaseFinancials({
    tenantId,
    batchNumber: batch.batchNumber,
    totalAmount: batch.totalAmount,
    paidAmount: batch.paidAmount,
    remainingAmount: batch.remainingAmount,
    paymentMethod: batch.paymentMethod,
    actorId,
  });

  // 3. Update Supplier Khata Liability Balance
  if (batch.remainingAmount > 0) {
    await Supplier.findByIdAndUpdate(batch.supplierId, {
      $inc: { payableBalance: batch.remainingAmount },
    });
  }

  // 4. Mark Batch as Received
  batch.status = 'received';
  batch.receivedAt = new Date();
  await batch.save();

  return batch;
};

