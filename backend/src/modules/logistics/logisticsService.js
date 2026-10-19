import mongoose from 'mongoose';
import { Parcel } from './Parcel.js';
import { Return } from './Return.js';
import { Order } from '../orders/Order.js';
import { Product } from '../products/Product.js';
import { restoreStock } from '../inventory/inventoryService.js';
import { recordExpense } from '../finance/financeService.js';

export const generateReturnNumber = async (tenantId) => {
  const count = await Return.countDocuments({ tenantId });
  const sequence = String(count + 1).padStart(4, '0');
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `RET-${sequence}-${rand}`;
};

/**
 * 1. Book / Dispatch Parcel for an Order
 */
export const createParcel = async ({
  tenantId,
  orderId,
  trackingNumber,
  courier = 'manual',
  notes = '',
  actorId,
}) => {
  const order = await Order.findOne({ _id: orderId, tenantId });
  if (!order) {
    throw new Error('Order not found in this store');
  }

  const existingParcel = await Parcel.findOne({ tenantId, trackingNumber: String(trackingNumber).trim() });
  if (existingParcel) {
    throw new Error(`Tracking number "${trackingNumber}" is already in use`);
  }

  const parcel = new Parcel({
    tenantId,
    orderId: order._id,
    orderNumber: order.orderNumber,
    trackingNumber: String(trackingNumber).trim(),
    courier,
    codAmount: order.payment.status === 'paid' ? 0 : order.financials.outstandingBalance,
    customer: {
      name: order.customer.name,
      phone: order.customer.phone,
      address: order.customer.shippingAddress?.street || '',
      city: order.customer.shippingAddress?.city || '',
    },
    status: 'dispatched',
    dispatchedAt: new Date(),
    notes,
    createdById: actorId,
  });

  await parcel.save();

  // Update Order fulfillment status
  order.fulfillment.status = 'dispatched';
  order.fulfillment.courier = {
    provider: courier,
    trackingNumber: parcel.trackingNumber,
    dispatchedAt: parcel.dispatchedAt,
  };
  order.history.push({
    status: 'dispatched',
    actorId,
    note: `Dispatched via ${courier.toUpperCase()} (Tracking: ${parcel.trackingNumber})`,
  });

  await order.save();
  return { parcel, order };
};

/**
 * 2. Inspect and Process Returned Parcel (Restockable vs Damaged Grading)
 */
export const inspectAndProcessReturn = async ({
  tenantId,
  orderId,
  parcelId,
  trackingNumber = '',
  items, // [{ productId, quantity, condition }]
  reason,
  notes = '',
  actorId,
}) => {
  const order = await Order.findOne({ _id: orderId, tenantId });
  if (!order) {
    throw new Error('Order not found in this store');
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Return inspection must include at least one item');
  }

  const returnNumber = await generateReturnNumber(tenantId);
  const processedItems = [];
  const restockItems = [];

  for (const item of items) {
    const product = await Product.findOne({ _id: item.productId, tenantId });
    if (!product) {
      throw new Error(`Product ${item.productId} not found in this store`);
    }

    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const condition = item.condition || 'restockable';

    if (condition === 'restockable') {
      // Qualifies for physical restock back into inventory
      restockItems.push({
        productId: product._id,
        quantity: qty,
      });

      processedItems.push({
        productId: product._id,
        name: product.name,
        quantity: qty,
        condition: 'restockable',
        actionTaken: 'restocked',
      });
    } else {
      // Damaged / defective: Do NOT restore physical stock!
      // Record damage write-off in double-entry FinanceLedger
      const unitCost = Number(product.pricing.costPrice || 0);
      const totalLoss = unitCost * qty;

      if (totalLoss > 0) {
        await recordExpense({
          tenantId,
          category: 'damage_expense',
          amount: totalLoss,
          paymentMethod: 'cash',
          description: `Damage write-off for return #${returnNumber}: ${qty}x ${product.name}`,
          referenceId: returnNumber,
          actorId,
        });
      }

      processedItems.push({
        productId: product._id,
        name: product.name,
        quantity: qty,
        condition,
        actionTaken: 'written_off',
      });
    }
  }

  // 1. Physically restock restockable units and log in StockLedger
  if (restockItems.length > 0) {
    await restoreStock({
      tenantId,
      items: restockItems,
      type: 'RETURN_RESTOCK',
      referenceModel: 'Return',
      referenceId: returnNumber,
      actorId,
      reason: `Customer return restocked #${returnNumber} (Order #${order.orderNumber})`,
    });
  }

  // 2. Save Return Record
  const returnRecord = new Return({
    tenantId,
    returnNumber,
    orderId: order._id,
    orderNumber: order.orderNumber,
    parcelId,
    trackingNumber,
    customer: {
      name: order.customer.name,
      phone: order.customer.phone,
    },
    items: processedItems,
    reason: reason || 'Customer returned package',
    status: 'inspected',
    inspectorId: actorId,
    inspectedAt: new Date(),
    notes,
  });

  await returnRecord.save();

  // 3. Update Order status
  order.fulfillment.status = 'returned';
  order.history.push({
    status: 'returned',
    actorId,
    note: `Return inspected (#${returnNumber}): ${restockItems.length} items restocked.`,
  });
  await order.save();

  // 4. Update Parcel status if parcelId provided
  if (parcelId) {
    await Parcel.findOneAndUpdate(
      { _id: parcelId, tenantId },
      { status: 'returned', returnedAt: new Date() }
    );
  }

  return returnRecord;
};
