import { Parcel } from './Parcel.js';
import { Return } from './Return.js';
import { createParcel, inspectAndProcessReturn } from './logisticsService.js';

export const dispatchParcel = async (req, res) => {
  try {
    const { orderId, trackingNumber, courier, notes } = req.body || {};
    if (!orderId || !trackingNumber) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'orderId and trackingNumber are required.' },
      });
    }

    const result = await createParcel({
      tenantId: req.tenantId,
      orderId,
      trackingNumber,
      courier,
      notes,
      actorId: req.user?._id,
    });

    return res.status(201).json({
      success: true,
      data: result.parcel,
      message: 'Parcel booked and order marked dispatched.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'DISPATCH_FAILED', message: err.message },
    });
  }
};

export const listParcels = async (req, res) => {
  try {
    const query = req.scopeTenant({});
    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.trackingNumber) {
      query.trackingNumber = req.query.trackingNumber;
    }

    const parcels = await Parcel.find(query).sort({ createdAt: -1 });
    return res.json({
      success: true,
      data: parcels,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'PARCEL_FETCH_FAILED', message: err.message },
    });
  }
};

export const inspectReturn = async (req, res) => {
  try {
    const { orderId, parcelId, trackingNumber, items, reason, notes } = req.body || {};
    if (!orderId || !items || !reason) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'orderId, items, and reason are required.' },
      });
    }

    const returnRecord = await inspectAndProcessReturn({
      tenantId: req.tenantId,
      orderId,
      parcelId,
      trackingNumber,
      items,
      reason,
      notes,
      actorId: req.user?._id,
    });

    return res.status(201).json({
      success: true,
      data: returnRecord,
      message: 'Return inspected and physical restock / write-offs executed.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'INSPECTION_FAILED', message: err.message },
    });
  }
};

export const listReturns = async (req, res) => {
  try {
    const returns = await Return.find(req.scopeTenant({})).sort({ createdAt: -1 });
    return res.json({
      success: true,
      data: returns,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'RETURNS_FETCH_FAILED', message: err.message },
    });
  }
};

