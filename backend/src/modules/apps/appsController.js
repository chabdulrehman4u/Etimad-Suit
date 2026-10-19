import {
  connectProvider,
  listTenantConnections,
  disconnectProvider,
  bookShipmentWithProvider,
  trackShipmentWithProvider,
  handleCourierWebhook,
} from './appsService.js';
import { listSupportedCouriers } from './adapters/courierRegistry.js';

export const listSupported = async (req, res) => {
  return res.json({
    success: true,
    data: listSupportedCouriers(),
  });
};

export const saveConnection = async (req, res) => {
  try {
    const { providerId, category, credentials, settings } = req.body || {};
    if (!providerId || !credentials) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'providerId and credentials are required.' },
      });
    }

    const result = await connectProvider({
      tenantId: req.tenantId,
      providerId,
      category,
      credentials,
      settings,
      actorId: req.user?._id,
    });

    return res.status(201).json({
      success: true,
      data: result.connection,
      message: `${providerId.toUpperCase()} integration connected securely.`,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'CONNECTION_FAILED', message: err.message },
    });
  }
};

export const getConnections = async (req, res) => {
  try {
    const connections = await listTenantConnections(req.tenantId);
    return res.json({
      success: true,
      data: connections,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: err.message },
    });
  }
};

export const removeConnection = async (req, res) => {
  try {
    const { providerId } = req.params;
    const result = await disconnectProvider(req.tenantId, providerId);
    return res.json({
      success: true,
      data: result,
      message: `${providerId} disconnected successfully.`,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'DISCONNECT_FAILED', message: err.message },
    });
  }
};

export const bookShipment = async (req, res) => {
  try {
    const { providerId, orderId, parcelInfo } = req.body || {};
    if (!providerId || !orderId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'providerId and orderId are required.' },
      });
    }

    const result = await bookShipmentWithProvider({
      tenantId: req.tenantId,
      providerId,
      orderId,
      parcelInfo,
      actorId: req.user?._id,
    });

    const statusCode = result.fallback ? 202 : 201;
    return res.status(statusCode).json({
      success: result.success,
      fallback: result.fallback || false,
      data: {
        parcel: result.parcel,
        order: result.order,
        bookingResult: result.bookingResult,
      },
      warning: result.warning,
      message: result.fallback
        ? 'Courier API unavailable; order queued for dispatch.'
        : 'Shipment booked successfully with courier provider.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'BOOKING_FAILED', message: err.message },
    });
  }
};

export const trackShipment = async (req, res) => {
  try {
    const { providerId, trackingNumber } = req.params;
    const tracking = await trackShipmentWithProvider({
      tenantId: req.tenantId,
      providerId,
      trackingNumber,
    });

    return res.json({
      success: true,
      data: tracking,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'TRACKING_FAILED', message: err.message },
    });
  }
};

/**
 * Public Webhook Receiver for Courier Callbacks
 */
export const receiveWebhook = async (req, res) => {
  try {
    const { providerId } = req.params;
    const result = await handleCourierWebhook({
      providerId,
      payload: req.body,
      headers: req.headers,
    });

    return res.json({
      success: result.success,
      isDuplicate: result.isDuplicate,
      data: result,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'WEBHOOK_FAILED', message: err.message },
    });
  }
};
