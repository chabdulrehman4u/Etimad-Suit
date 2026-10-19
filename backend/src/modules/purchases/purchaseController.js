import { Supplier } from './Supplier.js';
import { PurchaseBatch } from './PurchaseBatch.js';
import { createPurchaseBatch, receivePurchaseBatch } from './purchaseService.js';

/**
 * 1. Supplier Management
 */
export const createSupplier = async (req, res) => {
  try {
    const { name, company, phone, email, address, notes } = req.body || {};
    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Supplier name and phone are required.' },
      });
    }

    const supplier = new Supplier({
      tenantId: req.tenantId,
      name,
      company,
      phone,
      email,
      address,
      notes,
    });

    await supplier.save();
    return res.status(201).json({
      success: true,
      data: supplier,
      message: 'Supplier created successfully.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'SUPPLIER_CREATE_FAILED', message: err.message },
    });
  }
};

export const listSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find(req.scopeTenant({})).sort({ name: 1 });
    return res.json({
      success: true,
      data: suppliers,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'SUPPLIERS_FETCH_FAILED', message: err.message },
    });
  }
};

/**
 * 2. Purchase Batch Management
 */
export const createBatch = async (req, res) => {
  try {
    const {
      supplierId,
      items,
      courierExpense,
      paymentStatus,
      paidAmount,
      paymentMethod,
      notes,
    } = req.body || {};

    const idempotencyKey = req.headers['idempotency-key'] || req.body?.idempotencyKey;

    const result = await createPurchaseBatch({
      tenantId: req.tenantId,
      supplierId,
      items,
      courierExpense,
      paymentStatus,
      paidAmount,
      paymentMethod,
      notes,
      actorId: req.user?._id,
      idempotencyKey,
    });

    const status = result.isDuplicate ? 200 : 201;
    return res.status(status).json({
      success: true,
      data: result.batch,
      isDuplicate: result.isDuplicate,
      message: result.isDuplicate
        ? 'Duplicate purchase order recognized.'
        : 'Purchase order created successfully.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'BATCH_CREATE_FAILED', message: err.message },
    });
  }
};

export const listBatches = async (req, res) => {
  try {
    const query = req.scopeTenant({});
    if (req.query.supplierId) {
      query.supplierId = req.query.supplierId;
    }
    if (req.query.status) {
      query.status = req.query.status;
    }

    const batches = await PurchaseBatch.find(query).sort({ createdAt: -1 });
    return res.json({
      success: true,
      data: batches,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'BATCH_LIST_FAILED', message: err.message },
    });
  }
};

export const receiveBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const batch = await receivePurchaseBatch({
      tenantId: req.tenantId,
      batchId: id,
      actorId: req.user?._id,
    });

    return res.json({
      success: true,
      data: batch,
      message: 'Purchase batch received, physical stock inbounded, and accounts updated.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'RECEIVE_FAILED', message: err.message },
    });
  }
};

