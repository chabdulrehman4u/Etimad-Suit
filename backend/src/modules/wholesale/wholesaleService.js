import mongoose from 'mongoose';
import { WholesaleCustomer } from './WholesaleCustomer.js';
import { Quotation } from './Quotation.js';
import { Product } from '../products/Product.js';
import { createCanonicalOrder } from '../orders/orderService.js';
import { recordDoubleEntry } from '../finance/financeService.js';

export const generateQuotationNumber = async (tenantId) => {
  const count = await Quotation.countDocuments({ tenantId });
  const sequence = String(count + 1).padStart(4, '0');
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `QTN-${sequence}-${rand}`;
};

/**
 * 1. Create Wholesale Customer Profile with Credit Limit & Terms
 */
export const createCustomer = async ({
  tenantId,
  name,
  companyName = '',
  phone,
  email = '',
  address = '',
  city = '',
  creditLimit = 0,
  creditTermsDays = 30,
  priceTier = 'standard',
  discountPercentage = 0,
  notes = '',
}) => {
  if (!name || !phone) {
    throw new Error('Customer name and phone number are required');
  }

  const existing = await WholesaleCustomer.findOne({ tenantId, phone: String(phone).trim() });
  if (existing) {
    throw new Error(`Wholesale customer with phone "${phone}" already exists in this store`);
  }

  const customer = new WholesaleCustomer({
    tenantId,
    name: String(name).trim(),
    companyName: String(companyName).trim(),
    phone: String(phone).trim(),
    email: String(email).trim().toLowerCase(),
    address: String(address).trim(),
    city: String(city).trim(),
    creditLimit: Math.max(0, Number(creditLimit) || 0),
    creditTermsDays: Math.max(1, Number(creditTermsDays) || 30),
    priceTier,
    discountPercentage: Math.max(0, Math.min(100, Number(discountPercentage) || 0)),
    notes,
  });

  await customer.save();
  return customer;
};

/**
 * 2. Create Wholesale Quotation
 */
export const createQuotation = async ({
  tenantId,
  customerId,
  items, // [{ productId, quantity, unitPrice? }]
  discountTotal = 0,
  validDays = 14,
  notes = '',
  actorId,
}) => {
  const customer = await WholesaleCustomer.findOne({ _id: customerId, tenantId });
  if (!customer) {
    throw new Error('Wholesale customer not found in this store');
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Quotation must contain at least one product item');
  }

  let subtotal = 0;
  const processedItems = [];

  for (const item of items) {
    const product = await Product.findOne({ _id: item.productId, tenantId });
    if (!product) {
      throw new Error(`Product ${item.productId} not found in this store`);
    }

    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);

    // Resolve authoritative price: custom override, wholesale price, or retail price
    let unitPrice = item.unitPrice != null ? Number(item.unitPrice) : (product.pricing.wholesalePrice || product.pricing.retailPrice);
    if (customer.discountPercentage > 0 && item.unitPrice == null) {
      unitPrice = Math.round(unitPrice * (1 - customer.discountPercentage / 100));
    }

    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;

    processedItems.push({
      productId: product._id,
      name: product.name,
      sku: product.sku || '',
      quantity: qty,
      unitPrice,
      lineTotal,
    });
  }

  const numDiscount = Math.min(subtotal, Math.max(0, Number(discountTotal) || 0));
  const grandTotal = Math.max(0, subtotal - numDiscount);
  const quotationNumber = await generateQuotationNumber(tenantId);
  const validUntil = new Date(Date.now() + Math.max(1, validDays) * 24 * 60 * 60 * 1000);

  const quotation = new Quotation({
    tenantId,
    quotationNumber,
    customerId: customer._id,
    customerName: customer.name,
    customerPhone: customer.phone,
    items: processedItems,
    subtotal,
    discountTotal: numDiscount,
    grandTotal,
    validUntil,
    status: 'draft',
    notes,
    createdById: actorId,
  });

  await quotation.save();
  return quotation;
};

/**
 * 3. Convert Quotation to Canonical Wholesale Order with Credit Limit Enforcement
 */
export const convertQuotationToOrder = async ({
  tenantId,
  quotationId,
  paymentMethod = 'credit', // 'credit', 'cash', 'bank'
  amountPaid = 0,
  notes = '',
  actorId,
}) => {
  const quotation = await Quotation.findOne({ _id: quotationId, tenantId });
  if (!quotation) {
    throw new Error('Quotation not found in this store');
  }

  if (quotation.status === 'converted') {
    throw new Error(`Quotation #${quotation.quotationNumber} has already been converted to an order`);
  }

  if (quotation.status === 'expired' || new Date() > quotation.validUntil) {
    quotation.status = 'expired';
    await quotation.save();
    throw new Error(`Quotation #${quotation.quotationNumber} has expired`);
  }

  const customer = await WholesaleCustomer.findOne({ _id: quotation.customerId, tenantId });
  if (!customer) {
    throw new Error('Wholesale customer not found in this store');
  }

  const cleanPaid = Math.min(quotation.grandTotal, Math.max(0, Number(amountPaid) || 0));
  const unpaidPortion = Math.max(0, quotation.grandTotal - cleanPaid);

  // STRICT CREDIT LIMIT ENFORCEMENT:
  // If customer has a credit limit and adding this order exceeds it, reject immediately!
  if (unpaidPortion > 0 && customer.creditLimit > 0) {
    const projectedBalance = customer.outstandingBalance + unpaidPortion;
    if (projectedBalance > customer.creditLimit) {
      throw new Error(
        `Credit limit exceeded for "${customer.name}". ` +
        `Current Khata: Rs. ${customer.outstandingBalance}, Order Debt: Rs. ${unpaidPortion}, Total: Rs. ${projectedBalance}. ` +
        `Authorized Limit: Rs. ${customer.creditLimit}.`
      );
    }
  }

  // 1. Create Canonical Order (Channel: 'wholesale')
  const orderResult = await createCanonicalOrder({
    tenantId,
    channel: 'wholesale',
    customer: {
      customerId: customer._id,
      name: customer.name,
      phone: customer.phone,
      shippingAddress: {
        street: customer.address,
        city: customer.city,
      },
    },
    items: quotation.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      priceOverride: i.unitPrice,
    })),
    payment: {
      method: paymentMethod,
      status: cleanPaid >= quotation.grandTotal ? 'paid' : (cleanPaid > 0 ? 'partially_paid' : 'unpaid'),
      amountPaid: cleanPaid,
    },
    manualDiscount: quotation.discountTotal,
    canOverridePrice: true,
    createdById: actorId,
    notes: notes || `Converted from Quotation #${quotation.quotationNumber}`,
  });

  const order = orderResult.order;

  // 2. Update Customer Khata Balance with unpaid debt
  if (unpaidPortion > 0) {
    customer.outstandingBalance += unpaidPortion;
    await customer.save();
  }

  // 3. Mark Quotation Converted
  quotation.status = 'converted';
  quotation.convertedOrderId = order._id;
  await quotation.save();

  return { quotation, order, customer };
};

/**
 * 4. Record Wholesale Customer Khata Payment
 */
export const recordCustomerKhataPayment = async ({
  tenantId,
  customerId,
  amount,
  paymentMethod = 'cash',
  reference = '',
  actorId,
}) => {
  const customer = await WholesaleCustomer.findOne({ _id: customerId, tenantId });
  if (!customer) {
    throw new Error('Wholesale customer not found in this store');
  }

  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    throw new Error('Payment amount must be greater than 0');
  }

  const cashOrBank = paymentMethod === 'bank' ? 'bank' : 'cash';

  // Double Entry: Debit Cash/Bank, Credit Accounts Receivable
  const paymentEntry = await recordDoubleEntry({
    tenantId,
    type: 'CUSTOMER_PAYMENT',
    debitAccount: cashOrBank,
    creditAccount: 'accounts_receivable',
    amount: numAmount,
    referenceModel: 'Manual',
    referenceId: customer._id.toString(),
    description: `Khata payment received from wholesale customer ${customer.name} ${reference ? `(Ref: ${reference})` : ''}`,
    actorId,
  });

  // Reduce customer live debt
  customer.outstandingBalance = Math.max(0, customer.outstandingBalance - numAmount);
  await customer.save();

  return { customer, paymentEntry };
};
