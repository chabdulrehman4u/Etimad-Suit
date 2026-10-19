import { Order } from '../../backend/src/modules/orders/Order.js';
import { Product } from '../../backend/src/modules/products/Product.js';

/**
 * Phase G: Historical Orders & Bills Unification Engine
 * Converts legacy Ecommerce orders, IMS retail bills, and wholesale orders
 * into the canonical multi-channel Order entity.
 */
export const migrateOrdersAndBills = async ({
  legacyEcommerceOrders = [],
  legacyImsBills = [],
  legacyWholesaleDispatches = [],
  flagshipTenantId,
}) => {
  let onlineOrdersMigrated = 0;
  let retailBillsMigrated = 0;
  let wholesaleOrdersMigrated = 0;
  let totalMigratedGmv = 0;

  // Cache fallback default product in case of legacy line item with deleted product
  let defaultProduct = await Product.findOne({ tenantId: flagshipTenantId });

  // 1. Convert Ecommerce Orders (channel: 'online')
  for (const rawOrder of legacyEcommerceOrders) {
    const orderNumber = String(rawOrder.orderNumber || rawOrder._id || `ECOM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`).trim();

    let order = await Order.findOne({ tenantId: flagshipTenantId, orderNumber });
    if (!order) {
      const items = [];
      let calculatedSubtotal = 0;
      let calculatedCogs = 0;

      for (const item of rawOrder.items || rawOrder.orderItems || []) {
        const qty = Math.max(1, Number(item.quantity || item.qty) || 1);
        const unitPrice = Math.max(0, Number(item.price || item.unitPrice || 0));
        const unitCost = Math.max(0, Number(item.costPrice || item.unitCost || (unitPrice * 0.6)));
        const lineTotal = qty * unitPrice;

        calculatedSubtotal += lineTotal;
        calculatedCogs += qty * unitCost;

        items.push({
          productId: item.productId || defaultProduct?._id,
          name: item.name || item.title || 'Ecommerce Item',
          sku: item.sku || 'ECOM-SKU',
          quantity: qty,
          unitPriceSnapshot: unitPrice,
          unitCostSnapshot: unitCost,
          lineDiscount: 0,
          lineTotal,
        });
      }

      const shippingFee = Number(rawOrder.shippingPrice || rawOrder.shippingFee || 0);
      const discountTotal = Number(rawOrder.discount || 0);
      const grandTotal = Math.max(0, calculatedSubtotal + shippingFee - discountTotal);
      const isPaid = rawOrder.isPaid === true || rawOrder.paymentStatus === 'paid';
      const amountPaid = isPaid ? grandTotal : (Number(rawOrder.amountPaid) || 0);
      const outstandingBalance = Math.max(0, grandTotal - amountPaid);

      order = new Order({
        tenantId: flagshipTenantId,
        orderNumber,
        channel: 'online',
        customer: {
          name: rawOrder.shippingAddress?.name || rawOrder.customerName || 'Online Customer',
          phone: rawOrder.shippingAddress?.phone || rawOrder.customerPhone || '03000000000',
          email: rawOrder.userEmail || rawOrder.email || undefined,
          shippingAddress: {
            street: rawOrder.shippingAddress?.address || rawOrder.address || '',
            city: rawOrder.shippingAddress?.city || 'Lahore',
            province: rawOrder.shippingAddress?.province || 'Punjab',
            postalCode: rawOrder.shippingAddress?.postalCode || '',
          },
        },
        items: items.length > 0 ? items : [{
          productId: defaultProduct?._id,
          name: 'Migrated Legacy Item',
          quantity: 1,
          unitPriceSnapshot: grandTotal,
          unitCostSnapshot: grandTotal * 0.6,
          lineTotal: grandTotal,
        }],
        financials: {
          subtotal: calculatedSubtotal,
          shippingFee,
          discountTotal,
          taxTotal: 0,
          grandTotal,
          amountPaid,
          outstandingBalance,
          cogsTotal: calculatedCogs,
          grossProfit: grandTotal - calculatedCogs,
        },
        payment: {
          method: rawOrder.paymentMethod === 'cod' ? 'cod' : (rawOrder.paymentMethod || 'cod'),
          status: isPaid ? 'paid' : (amountPaid > 0 ? 'partially_paid' : 'unpaid'),
          paidAt: rawOrder.paidAt || (isPaid ? new Date() : undefined),
        },
        fulfillment: {
          status: rawOrder.status === 'Delivered' ? 'delivered' : (rawOrder.status === 'Dispatched' ? 'dispatched' : 'pending'),
          courier: rawOrder.courier ? {
            provider: rawOrder.courier.provider || 'lcs',
            trackingNumber: rawOrder.courier.trackingNumber,
          } : undefined,
        },
      });

      await order.save();
      onlineOrdersMigrated++;
      totalMigratedGmv += grandTotal;
    }
  }

  // 2. Convert IMS Retail Bills (channel: 'retail')
  for (const rawBill of legacyImsBills) {
    const orderNumber = String(rawBill.billNumber || rawBill.invoiceNumber || `BILL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`).trim();

    let order = await Order.findOne({ tenantId: flagshipTenantId, orderNumber });
    if (!order) {
      const items = [];
      let calculatedSubtotal = 0;
      let calculatedCogs = 0;

      for (const item of rawBill.items || rawBill.products || []) {
        const qty = Math.max(1, Number(item.quantity || item.qty) || 1);
        const unitPrice = Math.max(0, Number(item.retailPrice || item.price || item.unitPrice || 0));
        const unitCost = Math.max(0, Number(item.costPrice || item.originalPrice || (unitPrice * 0.6)));
        const lineTotal = qty * unitPrice;

        calculatedSubtotal += lineTotal;
        calculatedCogs += qty * unitCost;

        items.push({
          productId: item.productId || defaultProduct?._id,
          name: item.name || 'POS Retail Item',
          sku: item.sku || item.model || 'POS-SKU',
          quantity: qty,
          unitPriceSnapshot: unitPrice,
          unitCostSnapshot: unitCost,
          lineDiscount: Number(item.discount || 0),
          lineTotal,
        });
      }

      const grandTotal = Math.max(0, Number(rawBill.totalAmount || rawBill.grandTotal || calculatedSubtotal));
      const amountPaid = Math.max(0, Number(rawBill.paidAmount || rawBill.amountPaid || grandTotal));
      const outstandingBalance = Math.max(0, grandTotal - amountPaid);

      order = new Order({
        tenantId: flagshipTenantId,
        orderNumber,
        channel: 'retail',
        customer: {
          name: rawBill.customerName || 'Walk-in Retail Customer',
          phone: rawBill.customerPhone || '03000000000',
        },
        items: items.length > 0 ? items : [{
          productId: defaultProduct?._id,
          name: 'POS Item',
          quantity: 1,
          unitPriceSnapshot: grandTotal,
          unitCostSnapshot: grandTotal * 0.6,
          lineTotal: grandTotal,
        }],
        financials: {
          subtotal: calculatedSubtotal || grandTotal,
          shippingFee: 0,
          discountTotal: Number(rawBill.discount || 0),
          taxTotal: 0,
          grandTotal,
          amountPaid,
          outstandingBalance,
          cogsTotal: calculatedCogs || (grandTotal * 0.6),
          grossProfit: grandTotal - (calculatedCogs || (grandTotal * 0.6)),
        },
        payment: {
          method: rawBill.paymentType === 'bank' ? 'bank_transfer' : (rawBill.paymentType === 'card' ? 'card' : 'cash'),
          status: outstandingBalance === 0 ? 'paid' : (amountPaid > 0 ? 'partially_paid' : 'unpaid'),
          paidAt: rawBill.createdAt || new Date(),
        },
        fulfillment: {
          status: 'delivered', // In-store POS is fulfilled at counter
        },
      });

      await order.save();
      retailBillsMigrated++;
      totalMigratedGmv += grandTotal;
    }
  }

  // 3. Convert Wholesale Dispatches (channel: 'wholesale')
  for (const rawWholesale of legacyWholesaleDispatches) {
    const orderNumber = String(rawWholesale.dispatchNumber || rawWholesale.orderNumber || `WHOLE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`).trim();

    let order = await Order.findOne({ tenantId: flagshipTenantId, orderNumber });
    if (!order) {
      const grandTotal = Math.max(0, Number(rawWholesale.totalAmount || rawWholesale.grandTotal || 0));
      const amountPaid = Math.max(0, Number(rawWholesale.amountPaid || 0));
      const outstandingBalance = Math.max(0, grandTotal - amountPaid);

      order = new Order({
        tenantId: flagshipTenantId,
        orderNumber,
        channel: 'wholesale',
        customer: {
          name: rawWholesale.customerName || 'Wholesale Client',
          phone: rawWholesale.customerPhone || '03000000000',
          shippingAddress: {
            street: rawWholesale.deliveryAddress || '',
            city: rawWholesale.city || 'Rawalpindi',
          },
        },
        items: [{
          productId: defaultProduct?._id,
          name: rawWholesale.title || 'Wholesale Lot',
          quantity: Number(rawWholesale.totalUnits || 1),
          unitPriceSnapshot: grandTotal / (Number(rawWholesale.totalUnits) || 1),
          unitCostSnapshot: (grandTotal * 0.7) / (Number(rawWholesale.totalUnits) || 1),
          lineTotal: grandTotal,
        }],
        financials: {
          subtotal: grandTotal,
          shippingFee: Number(rawWholesale.freightFee || 0),
          discountTotal: 0,
          taxTotal: 0,
          grandTotal,
          amountPaid,
          outstandingBalance,
          cogsTotal: grandTotal * 0.7,
          grossProfit: grandTotal * 0.3,
        },
        payment: {
          method: 'credit',
          status: outstandingBalance === 0 ? 'paid' : 'partially_paid',
        },
        fulfillment: {
          status: 'delivered',
        },
      });

      await order.save();
      wholesaleOrdersMigrated++;
      totalMigratedGmv += grandTotal;
    }
  }

  return {
    onlineOrdersMigrated,
    retailBillsMigrated,
    wholesaleOrdersMigrated,
    totalOrdersMigrated: onlineOrdersMigrated + retailBillsMigrated + wholesaleOrdersMigrated,
    totalMigratedGmv,
  };
};
