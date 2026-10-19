import mongoose from 'mongoose';
import { Order } from './Order.js';
import { calculateOrderPricing } from './pricingService.js';
import { batchDeductStock, restoreStock } from '../inventory/inventoryService.js';

// Generate human-friendly tenant-scoped order numbers
export const generateOrderNumber = async (tenantId, channel) => {
  const prefix = channel === 'retail' ? 'POS' : (channel === 'wholesale' ? 'WHO' : 'ORD');
  const count = await Order.countDocuments({ tenantId, channel });
  const sequence = String(count + 1).padStart(4, '0');
  const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${sequence}-${randomSuffix}`;
};

/**
 * 1. Create Canonical Order (Authoritative Pricing + Atomic Stock Deduction)
 */
export const createCanonicalOrder = async ({
  tenantId,
  channel, // 'online' | 'retail' | 'wholesale'
  customer,
  items, // [{ productId, quantity, priceOverride? }]
  payment,
  couponCode,
  manualDiscount = 0,
  canOverridePrice = false,
  idempotencyKey,
  createdById,
  notes,
}) => {
  if (!channel || !['online', 'retail', 'wholesale'].includes(channel)) {
    throw new Error('Valid channel (online, retail, wholesale) is required');
  }

  if (!customer || !customer.name || !customer.phone) {
    throw new Error('Customer name and phone number are required');
  }

  // Idempotency check: if already processed, return existing order
  if (idempotencyKey) {
    const cleanKey = String(idempotencyKey).trim();
    const existingOrder = await Order.findOne({ tenantId, idempotencyKey: cleanKey });
    if (existingOrder) {
      return { order: existingOrder, isDuplicate: true };
    }
  }

  // 1. Authoritative Pricing Calculation (Never trust client prices)
  const pricingResult = await calculateOrderPricing({
    tenantId,
    channel,
    items,
    couponCode,
    manualDiscount,
    canOverridePrice,
  });

  const orderNumber = await generateOrderNumber(tenantId, channel);

  // 2. Atomic Inventory Deduction
  // For online & POS, stock is deducted immediately.
  // Compensating rollback triggers automatically if any line item fails stock check.
  const deductionResult = await batchDeductStock({
    tenantId,
    items: pricingResult.lineItems.map((li) => ({
      productId: li.productId,
      quantity: li.quantity,
    })),
    type: 'SALE_DEDUCTION',
    referenceModel: 'Order',
    referenceId: orderNumber,
    idempotencyKey: idempotencyKey ? `order-stock-${idempotencyKey}` : undefined,
    actorId: createdById,
    reason: `${channel.toUpperCase()} Sale Order #${orderNumber}`,
  });

  // 3. Payment Defaults by Channel
  const paymentMethod = payment?.method || (channel === 'retail' ? 'cash' : 'cod');
  const initialPaymentStatus = channel === 'retail' && paymentMethod === 'cash' ? 'paid' : (payment?.status || 'unpaid');
  const amountPaid = initialPaymentStatus === 'paid' ? pricingResult.financials.grandTotal : Number(payment?.amountPaid || 0);
  const outstandingBalance = Math.max(0, pricingResult.financials.grandTotal - amountPaid);

  // 4. Fulfillment Status Defaults by Channel
  const initialFulfillmentStatus = channel === 'retail' ? 'delivered' : 'pending';

  // 5. Construct and Save Canonical Order
  const order = new Order({
    tenantId,
    orderNumber,
    channel,
    customer: {
      customerId: customer.customerId || undefined,
      name: String(customer.name).trim(),
      phone: String(customer.phone).trim(),
      email: customer.email ? String(customer.email).trim() : undefined,
      shippingAddress: customer.shippingAddress || {},
    },
    items: pricingResult.lineItems,
    financials: {
      ...pricingResult.financials,
      amountPaid,
      outstandingBalance,
    },
    payment: {
      method: paymentMethod,
      status: initialPaymentStatus,
      paidAt: initialPaymentStatus === 'paid' ? new Date() : undefined,
      notes: payment?.notes,
    },
    fulfillment: {
      status: initialFulfillmentStatus,
      courier: channel === 'online' ? { provider: 'lcs' } : undefined,
    },
    idempotencyKey: idempotencyKey ? String(idempotencyKey).trim() : undefined,
    history: [
      {
        status: initialFulfillmentStatus,
        actorId: createdById,
        note: `Order created via ${channel.toUpperCase()} channel`,
      },
    ],
    notes,
    createdById,
  });

  await order.save();

  return { order, isDuplicate: false };
};

/**
 * 2. Advance Order Status & Handle Stock Side-Effects
 */
export const updateOrderStatus = async ({
  tenantId,
  orderId,
  newFulfillmentStatus,
  newPaymentStatus,
  actorId,
  note,
}) => {
  const order = await Order.findOne({ _id: orderId, tenantId });
  if (!order) {
    throw new Error('Order not found in this store');
  }

  const previousFulfillment = order.fulfillment.status;

  // Stock Side-Effect: Order Cancellation restores physical stock
  if (newFulfillmentStatus === 'cancelled' && previousFulfillment !== 'cancelled') {
    await restoreStock({
      tenantId,
      items: order.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      type: 'STOCK_RELEASE',
      referenceModel: 'Order',
      referenceId: order.orderNumber,
      actorId,
      reason: `Order #${order.orderNumber} cancelled`,
    });
  }

  if (newFulfillmentStatus) {
    order.fulfillment.status = newFulfillmentStatus;
  }

  if (newPaymentStatus) {
    order.payment.status = newPaymentStatus;
    if (newPaymentStatus === 'paid') {
      order.payment.paidAt = new Date();
      order.financials.amountPaid = order.financials.grandTotal;
      order.financials.outstandingBalance = 0;
    }
  }

  order.history.push({
    status: newFulfillmentStatus || order.fulfillment.status,
    actorId,
    note: note || `Status updated to ${newFulfillmentStatus || order.fulfillment.status}`,
    timestamp: new Date(),
  });

  await order.save();
  return order;
};
