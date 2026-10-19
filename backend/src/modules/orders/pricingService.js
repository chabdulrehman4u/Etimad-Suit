import mongoose from 'mongoose';
import { Product } from '../products/Product.js';

/**
 * Authoritative Server-Side Pricing Engine
 * 
 * SECURITY MANDATE:
 * Never trust a client-submitted unitPrice, subtotal, discount, or delivery charge.
 * All amounts are calculated authoritatively on the backend.
 */
export const calculateOrderPricing = async ({
  tenantId,
  channel, // 'online' | 'retail' | 'wholesale'
  items,   // [{ productId, quantity, priceOverride? }]
  couponCode,
  manualDiscount = 0,
  canOverridePrice = false,
}) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Order must include at least one item');
  }

  const normalizedLineItems = [];
  let subtotal = 0;
  let cogsTotal = 0;
  let hasNonFreeShippingItem = false;

  for (const rawItem of items) {
    const pId = rawItem.productId || rawItem._id;
    const qty = Math.max(1, parseInt(rawItem.quantity, 10) || 1);

    if (!mongoose.Types.ObjectId.isValid(pId)) {
      throw new Error(`Invalid product ID: ${pId}`);
    }

    const product = await Product.findOne({ _id: pId, tenantId });
    if (!product) {
      throw new Error(`Product not found in this store: ${pId}`);
    }

    // 1. Channel Pricing Resolution
    let authoritativeUnitPrice = product.pricing.retailPrice;

    if (channel === 'online') {
      authoritativeUnitPrice = product.pricing.websitePrice || product.pricing.retailPrice;
    } else if (channel === 'retail') {
      authoritativeUnitPrice = product.pricing.retailPrice;
    } else if (channel === 'wholesale') {
      // Wholesale volume pricing tier logic:
      const minQty = product.pricing.minWholesaleQty || 6;
      if (qty >= minQty && product.pricing.wholesalePrice > 0) {
        authoritativeUnitPrice = product.pricing.wholesalePrice;
      } else {
        authoritativeUnitPrice = product.pricing.retailPrice;
      }
    }

    // Optional authorized price override (e.g., manager discount in POS)
    if (canOverridePrice && rawItem.priceOverride != null && Number(rawItem.priceOverride) >= 0) {
      authoritativeUnitPrice = Number(rawItem.priceOverride);
    }

    const unitCostSnapshot = Number(product.pricing.costPrice || 0);
    const lineTotal = authoritativeUnitPrice * qty;
    const lineCogs = unitCostSnapshot * qty;

    subtotal += lineTotal;
    cogsTotal += lineCogs;

    if (!product.freeShipping) {
      hasNonFreeShippingItem = true;
    }

    normalizedLineItems.push({
      productId: product._id,
      name: product.name,
      sku: product.sku || '',
      model: product.model || '',
      category: product.category,
      quantity: qty,
      unitPriceSnapshot: authoritativeUnitPrice,
      unitCostSnapshot,
      lineDiscount: 0,
      lineTotal,
    });
  }

  // 2. Shipping Calculation (Channel-specific rules)
  let shippingFee = 0;
  if (channel === 'online') {
    // Free delivery on orders over Rs. 3,000 or if all items have free shipping
    if (subtotal >= 3000 || !hasNonFreeShippingItem) {
      shippingFee = 0;
    } else {
      shippingFee = 200; // Standard domestic shipping flat rate
    }
  } else {
    shippingFee = 0; // POS and Wholesale walk-in default to 0 shipping
  }

  // 3. Discount & Coupon Evaluation
  let discountTotal = 0;
  let appliedCoupon = null;

  if (couponCode) {
    const cleanCoupon = String(couponCode).trim().toUpperCase();
    // Deterministic coupon evaluation rules
    if (cleanCoupon === 'SAVE10') {
      discountTotal = Math.round(subtotal * 0.1); // 10% off
      appliedCoupon = { code: 'SAVE10', type: 'percentage', amount: discountTotal };
    } else if (cleanCoupon === 'FLAT200' && subtotal >= 1000) {
      discountTotal = 200;
      appliedCoupon = { code: 'FLAT200', type: 'fixed', amount: 200 };
    } else {
      // Invalid coupon ignored or throws
    }
  }

  // Manual discount (e.g. from cashier with permission)
  if (manualDiscount > 0 && canOverridePrice) {
    discountTotal += Math.min(Number(manualDiscount), subtotal);
  }

  // 4. Authoritative Grand Total
  const grandTotal = Math.max(0, subtotal + shippingFee - discountTotal);
  const grossProfit = Math.max(0, grandTotal - shippingFee - cogsTotal);

  return {
    lineItems: normalizedLineItems,
    financials: {
      subtotal,
      shippingFee,
      discountTotal,
      taxTotal: 0,
      grandTotal,
      cogsTotal,
      grossProfit,
    },
    appliedCoupon,
  };
};
