import mongoose from 'mongoose';
import { AppConnection } from './AppConnection.js';
import { getCourierAdapter } from './adapters/courierRegistry.js';
import { Order } from '../orders/Order.js';
import { Parcel } from '../logistics/Parcel.js';

/**
 * 1. Connect Integration Provider with AES-256 Encrypted Credentials
 */
export const connectProvider = async ({
  tenantId,
  providerId,
  category = 'courier',
  credentials = {},
  settings = {},
  actorId,
}) => {
  if (!providerId) {
    throw new Error('providerId is required');
  }

  let connection = await AppConnection.findOne({ tenantId, providerId });
  if (!connection) {
    connection = new AppConnection({
      tenantId,
      providerId,
      category,
      createdById: actorId,
    });
  }

  connection.setCredentials(credentials);
  connection.settings = { ...connection.settings, ...settings };
  connection.isEnabled = true;
  connection.status = 'connected';
  connection.lastSyncAt = new Date();
  connection.lastError = '';

  await connection.save();

  return {
    connection: {
      _id: connection._id,
      tenantId: connection.tenantId,
      providerId: connection.providerId,
      category: connection.category,
      isEnabled: connection.isEnabled,
      status: connection.status,
      settings: connection.settings,
      maskedCredentials: connection.getMaskedCredentials(),
      lastSyncAt: connection.lastSyncAt,
    },
  };
};

/**
 * 2. Get All Active App Connections (with Masked Credentials)
 */
export const listTenantConnections = async (tenantId) => {
  const connections = await AppConnection.find({ tenantId });
  return connections.map((conn) => ({
    _id: conn._id,
    providerId: conn.providerId,
    category: conn.category,
    isEnabled: conn.isEnabled,
    status: conn.status,
    settings: conn.settings,
    maskedCredentials: conn.getMaskedCredentials(),
    lastSyncAt: conn.lastSyncAt,
    lastError: conn.lastError,
  }));
};

/**
 * 3. Disconnect Provider
 */
export const disconnectProvider = async (tenantId, providerId) => {
  const connection = await AppConnection.findOne({ tenantId, providerId });
  if (!connection) {
    throw new Error(`Connection for ${providerId} not found`);
  }

  connection.isEnabled = false;
  connection.status = 'disconnected';
  await connection.save();

  return { providerId, status: 'disconnected' };
};

/**
 * 4. Resilient Shipment Booking via Provider Adapter
 * FAULT TOLERANCE MANDATE: Third-party courier outages MUST NOT block order saves
 */
export const bookShipmentWithProvider = async ({
  tenantId,
  providerId,
  orderId,
  parcelInfo = {},
  actorId,
}) => {
  const order = await Order.findOne({ _id: orderId, tenantId });
  if (!order) {
    throw new Error('Order not found in this store');
  }

  const connection = await AppConnection.findOne({
    tenantId,
    providerId,
    isEnabled: true,
  });

  if (!connection) {
    throw new Error(`Courier provider "${providerId}" is not connected or disabled for this store`);
  }

  const credentials = connection.getDecryptedCredentials();
  const adapter = getCourierAdapter(providerId);

  try {
    // Attempt live booking via adapter
    const bookingResult = await adapter.bookShipment({
      credentials,
      settings: connection.settings,
      order,
      parcelInfo,
    });

    const trackingNumber = bookingResult.trackingNumber;

    // Create Parcel record in database
    const parcel = new Parcel({
      tenantId,
      orderId: order._id,
      orderNumber: order.orderNumber,
      trackingNumber,
      courier: providerId,
      codAmount: order.payment.status === 'paid' ? 0 : order.financials.outstandingBalance,
      customer: {
        name: order.customer.name,
        phone: order.customer.phone,
        address: order.customer.shippingAddress?.street || '',
        city: order.customer.shippingAddress?.city || '',
      },
      status: 'dispatched',
      dispatchedAt: new Date(),
      notes: `Booked via ${providerId.toUpperCase()} integration (Slip: ${bookingResult.bookingRef})`,
      createdById: actorId,
    });

    await parcel.save();

    // Advance order fulfillment
    order.fulfillment.status = 'dispatched';
    order.fulfillment.courier = {
      provider: providerId,
      trackingNumber,
      bookingRef: bookingResult.bookingRef,
      dispatchedAt: parcel.dispatchedAt,
    };
    order.history.push({
      status: 'dispatched',
      actorId,
      note: `Dispatched via ${providerId.toUpperCase()} (Tracking: ${trackingNumber})`,
    });
    await order.save();

    connection.lastSyncAt = new Date();
    await connection.save();

    return {
      success: true,
      parcel,
      order,
      bookingResult,
    };
  } catch (err) {
    // GRACEFUL DEGRADATION / FAULT-TOLERANT FALLBACK:
    // If courier API is down or times out, save fallback parcel and keep order intact
    console.error(`[Courier Outage Alert] Provider ${providerId} booking failed:`, err.message);

    const fallbackTracking = `FALLBACK-${Date.now().toString().slice(-6)}`;
    const parcel = new Parcel({
      tenantId,
      orderId: order._id,
      orderNumber: order.orderNumber,
      trackingNumber: fallbackTracking,
      courier: providerId,
      codAmount: order.payment.status === 'paid' ? 0 : order.financials.outstandingBalance,
      customer: {
        name: order.customer.name,
        phone: order.customer.phone,
        address: order.customer.shippingAddress?.street || '',
        city: order.customer.shippingAddress?.city || '',
      },
      status: 'booked', // Kept in booked state for manual retry
      notes: `Automated booking failed (${err.message}). Queued for manual dispatch.`,
      createdById: actorId,
    });
    await parcel.save();

    connection.lastError = err.message;
    await connection.save();

    return {
      success: false,
      fallback: true,
      parcel,
      order,
      warning: `Courier service (${providerId.toUpperCase()}) temporarily unavailable. Order saved safely and queued for manual dispatch.`,
    };
  }
};

/**
 * 5. Track Shipment
 */
export const trackShipmentWithProvider = async ({ tenantId, providerId, trackingNumber }) => {
  const connection = await AppConnection.findOne({ tenantId, providerId });
  if (!connection) {
    throw new Error(`Provider ${providerId} is not connected`);
  }

  const adapter = getCourierAdapter(providerId);
  const credentials = connection.getDecryptedCredentials();

  return adapter.trackShipment({
    credentials,
    settings: connection.settings,
    trackingNumber,
  });
};

/**
 * 6. Idempotent Courier Webhook Receiver
 */
export const handleCourierWebhook = async ({ providerId, payload, headers, tenantId }) => {
  const adapter = getCourierAdapter(providerId);

  const verification = await adapter.verifyWebhook({ payload, headers });
  if (!verification.isValid || !verification.trackingNumber) {
    return { success: false, message: 'Invalid or unrecognized webhook payload' };
  }

  const { trackingNumber, status } = verification;

  // Find target parcel
  const query = { trackingNumber };
  if (tenantId) query.tenantId = tenantId;

  const parcel = await Parcel.findOne(query);
  if (!parcel) {
    return { success: false, message: `Parcel with tracking #${trackingNumber} not found` };
  }

  // Idempotency: If status already matches, no-op
  if (parcel.status === status) {
    return { success: true, isDuplicate: true, status };
  }

  parcel.status = status;
  if (status === 'delivered') parcel.deliveredAt = new Date();
  if (status === 'returned') parcel.returnedAt = new Date();
  await parcel.save();

  // Synchronize Order fulfillment status
  if (parcel.orderId) {
    await Order.findByIdAndUpdate(parcel.orderId, {
      $set: { 'fulfillment.status': status },
      $push: {
        history: {
          status,
          note: `Status updated to "${status}" via ${providerId.toUpperCase()} webhook callback`,
          timestamp: new Date(),
        },
      },
    });
  }

  return {
    success: true,
    isDuplicate: false,
    trackingNumber,
    status,
    parcelId: parcel._id,
  };
};
