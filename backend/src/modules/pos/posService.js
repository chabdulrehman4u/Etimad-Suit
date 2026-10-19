import mongoose from 'mongoose';
import { CashierShift } from './CashierShift.js';
import { Product } from '../products/Product.js';
import { createCanonicalOrder } from '../orders/orderService.js';
import { Tenant } from '../tenants/Tenant.js';

export const generateShiftNumber = async (tenantId) => {
  const count = await CashierShift.countDocuments({ tenantId });
  const sequence = String(count + 1).padStart(4, '0');
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `SHIFT-${sequence}-${rand}`;
};

/**
 * 1. Fast Barcode / SKU Scanner Lookup
 */
export const lookupProductByBarcode = async (tenantId, code) => {
  if (!code) {
    throw new Error('Barcode or SKU is required for lookup');
  }

  const cleanCode = String(code).trim();

  // Try barcode, sku, model, or ObjectId
  const query = {
    tenantId,
    $or: [{ barcode: cleanCode }, { sku: cleanCode }, { model: cleanCode }],
  };

  if (mongoose.Types.ObjectId.isValid(cleanCode)) {
    query.$or.push({ _id: cleanCode });
  }

  const product = await Product.findOne(query);
  if (!product) {
    throw new Error(`Product not found with barcode/SKU: "${cleanCode}"`);
  }

  return {
    productId: product._id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    model: product.model,
    price: product.pricing.retailPrice,
    costPrice: product.pricing.costPrice,
    stock: product.stock,
    isLowStock: product.stock <= product.lowStockThreshold,
  };
};

/**
 * 2. Open Cashier Shift
 */
export const openShift = async ({
  tenantId,
  cashierId,
  cashierName,
  openingCash = 0,
  registerId = 'REG-1',
}) => {
  // Check if cashier already has an active open shift
  const activeShift = await CashierShift.findOne({
    tenantId,
    cashierId,
    status: 'open',
  });

  if (activeShift) {
    throw new Error(`Cashier "${cashierName}" already has an open shift (#${activeShift.shiftNumber})`);
  }

  const shiftNumber = await generateShiftNumber(tenantId);
  const numOpeningCash = Math.max(0, Number(openingCash) || 0);

  const shift = new CashierShift({
    tenantId,
    shiftNumber,
    cashierId,
    cashierName,
    registerId,
    openingCash: numOpeningCash,
    expectedCash: numOpeningCash,
    status: 'open',
    openingTime: new Date(),
  });

  await shift.save();
  return shift;
};

/**
 * 3. Get Current Open Shift
 */
export const getCurrentShift = async (tenantId, cashierId) => {
  const shift = await CashierShift.findOne({
    tenantId,
    cashierId,
    status: 'open',
  });

  return shift;
};

/**
 * 4. Close Shift & Reconcile Cash Drawer
 */
export const closeShift = async ({
  tenantId,
  shiftId,
  actualCash,
  closingNotes = '',
}) => {
  const shift = await CashierShift.findOne({ _id: shiftId, tenantId });
  if (!shift) {
    throw new Error('Shift not found in this store');
  }

  if (shift.status === 'closed') {
    throw new Error('This shift has already been closed');
  }

  const numActualCash = Math.max(0, Number(actualCash) || 0);
  const expectedCash = shift.openingCash + shift.totalCashSales;
  const cashDifference = numActualCash - expectedCash; // Positive = surplus, Negative = shortage

  shift.actualCash = numActualCash;
  shift.expectedCash = expectedCash;
  shift.cashDifference = cashDifference;
  shift.status = 'closed';
  shift.closingTime = new Date();
  shift.closingNotes = closingNotes;

  await shift.save();

  return {
    shift,
    reconciliation: {
      openingCash: shift.openingCash,
      totalCashSales: shift.totalCashSales,
      totalCardSales: shift.totalCardSales,
      expectedCash,
      actualCash: numActualCash,
      cashDifference,
      isBalanced: cashDifference === 0,
      hasShortage: cashDifference < 0,
      hasSurplus: cashDifference > 0,
    },
  };
};

/**
 * 5. Create Fast POS Retail Sale (Single or Split Payments)
 */
export const createPosSale = async ({
  tenantId,
  cashierId,
  shiftId,
  items,
  customer = {},
  payment = {},
  manualDiscount = 0,
  notes = '',
  idempotencyKey,
}) => {
  const paymentMethod = payment.method || 'cash'; // 'cash', 'card', 'split'
  const cashTendered = Number(payment.cashTendered || 0);
  const cashPaid = Number(payment.cashPaid || (paymentMethod === 'cash' ? cashTendered : 0));
  const cardPaid = Number(payment.cardPaid || (paymentMethod === 'card' ? cashTendered : 0));

  // 1. Process Canonical Order via Channel 'retail'
  const orderResult = await createCanonicalOrder({
    tenantId,
    channel: 'retail',
    customer: {
      name: customer.name || 'Walk-in Customer',
      phone: customer.phone || '03000000000',
    },
    items,
    payment: {
      method: paymentMethod === 'split' ? 'cash' : paymentMethod,
      status: 'paid',
      amountPaid: cashPaid + cardPaid,
    },
    manualDiscount,
    canOverridePrice: true,
    createdById: cashierId,
    notes,
    idempotencyKey,
  });

  const order = orderResult.order;
  const grandTotal = order.financials.grandTotal;

  // Calculate change due if customer tendered more cash than order grandTotal
  let changeDue = 0;
  if (paymentMethod === 'cash' && cashTendered > grandTotal) {
    changeDue = cashTendered - grandTotal;
  }

  // 2. Accrue to Active Cashier Shift if open
  let activeShift = null;
  if (shiftId) {
    activeShift = await CashierShift.findOne({ _id: shiftId, tenantId, status: 'open' });
  } else {
    activeShift = await CashierShift.findOne({ tenantId, cashierId, status: 'open' });
  }

  if (activeShift) {
    const netCashFromSale = paymentMethod === 'cash' ? grandTotal : (paymentMethod === 'split' ? cashPaid : 0);
    const netCardFromSale = paymentMethod === 'card' ? grandTotal : (paymentMethod === 'split' ? cardPaid : 0);

    activeShift.totalSalesCount += 1;
    activeShift.totalCashSales += netCashFromSale;
    activeShift.totalCardSales += netCardFromSale;
    activeShift.expectedCash += netCashFromSale;
    if (paymentMethod === 'split') {
      activeShift.totalSplitSales += 1;
    }

    await activeShift.save();
  }

  // 3. Format Printable POS Receipt
  const tenant = await Tenant.findById(tenantId);
  const receipt = {
    storeName: tenant?.name || 'Etimad Retail POS',
    orderNumber: order.orderNumber,
    date: order.createdAt,
    cashierName: activeShift?.cashierName || 'Staff',
    customerName: order.customer.name,
    items: order.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPriceSnapshot,
      lineTotal: i.lineTotal,
    })),
    subtotal: order.financials.subtotal,
    discountTotal: order.financials.discountTotal,
    grandTotal: order.financials.grandTotal,
    paymentMethod,
    cashTendered: cashTendered || grandTotal,
    changeDue,
    currencySymbol: tenant?.settings?.currencySymbol || 'Rs.',
  };

  return {
    order,
    receipt,
    shift: activeShift,
    isDuplicate: orderResult.isDuplicate,
  };
};

