import mongoose from 'mongoose';
import { Order } from './Order.js';
import { createCanonicalOrder, updateOrderStatus } from './orderService.js';
import { hasPermission, PERMISSIONS } from '../auth/roles.js';

/**
 * 1. Create Order (Omnichannel: online, retail POS, wholesale)
 */
export const createOrder = async (req, res) => {
  try {
    const {
      channel = 'online',
      customer,
      items,
      payment,
      couponCode,
      manualDiscount,
      notes,
    } = req.body || {};

    const idempotencyKey = req.headers['idempotency-key'] || req.body?.idempotencyKey;

    // Check if user is allowed to override pricing
    const canOverridePrice = hasPermission(
      req.membership?.role,
      PERMISSIONS.ORDERS_CREATE_POS,
      req.membership?.customPermissions
    );

    const result = await createCanonicalOrder({
      tenantId: req.tenantId,
      channel,
      customer,
      items,
      payment,
      couponCode,
      manualDiscount: Number(manualDiscount || 0),
      canOverridePrice,
      idempotencyKey,
      createdById: req.user?._id,
      notes,
    });

    const statusCode = result.isDuplicate ? 200 : 201;
    return res.status(statusCode).json({
      success: true,
      data: result.order,
      isDuplicate: result.isDuplicate,
      message: result.isDuplicate
        ? 'Duplicate order request recognized; returning existing order.'
        : 'Order created successfully.',
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: {
        code: err.code || 'ORDER_CREATION_FAILED',
        message: err.message,
        details: err.details,
      },
    });
  }
};

/**
 * 2. List Orders (Tenant Scoped & Filterable)
 */
export const listOrders = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = req.scopeTenant({});

    if (req.query.channel) {
      query.channel = req.query.channel;
    }

    if (req.query.fulfillmentStatus) {
      query['fulfillment.status'] = req.query.fulfillmentStatus;
    }

    if (req.query.paymentStatus) {
      query['payment.status'] = req.query.paymentStatus;
    }

    if (req.query.search) {
      const term = String(req.query.search).trim();
      query.$or = [
        { orderNumber: { $regex: term, $options: 'i' } },
        { 'customer.name': { $regex: term, $options: 'i' } },
        { 'customer.phone': term },
      ];
    }

    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'LIST_FAILED', message: err.message },
    });
  }
};

/**
 * 3. Get Order By ID (Tenant Scoped)
 */
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Malformed order ID.' },
      });
    }

    const order = await Order.findOne(req.scopeTenant({ _id: id }));
    if (!order) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Order not found in this store.' },
      });
    }

    return res.json({
      success: true,
      data: order,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: err.message },
    });
  }
};

/**
 * 4. Update Order Status (Fulfillment & Payment)
 */
export const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { fulfillmentStatus, paymentStatus, note } = req.body || {};

    const updated = await updateOrderStatus({
      tenantId: req.tenantId,
      orderId: id,
      newFulfillmentStatus: fulfillmentStatus,
      newPaymentStatus: paymentStatus,
      actorId: req.user?._id,
      note,
    });

    return res.json({
      success: true,
      data: updated,
      message: 'Order status updated successfully.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'STATUS_UPDATE_FAILED', message: err.message },
    });
  }
};

