import {
  lookupProductByBarcode,
  openShift,
  getCurrentShift,
  closeShift,
  createPosSale,
} from './posService.js';

export const lookupItem = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_CODE', message: 'Barcode or SKU code is required.' },
      });
    }

    const product = await lookupProductByBarcode(req.tenantId, code);
    return res.json({
      success: true,
      data: product,
    });
  } catch (err) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: err.message },
    });
  }
};

export const openCashierShift = async (req, res) => {
  try {
    const { openingCash, registerId } = req.body || {};
    const shift = await openShift({
      tenantId: req.tenantId,
      cashierId: req.user?._id,
      cashierName: req.user?.name || 'Cashier',
      openingCash,
      registerId,
    });

    return res.status(201).json({
      success: true,
      data: shift,
      message: 'Cashier shift opened successfully.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'SHIFT_OPEN_FAILED', message: err.message },
    });
  }
};

export const getShiftStatus = async (req, res) => {
  try {
    const shift = await getCurrentShift(req.tenantId, req.user?._id);
    return res.json({
      success: true,
      data: shift,
      isOpen: Boolean(shift),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'SHIFT_FETCH_FAILED', message: err.message },
    });
  }
};

export const closeCashierShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { actualCash, closingNotes } = req.body || {};

    if (actualCash == null) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ACTUAL_CASH', message: 'actualCash count is required to close shift.' },
      });
    }

    const result = await closeShift({
      tenantId: req.tenantId,
      shiftId: id,
      actualCash,
      closingNotes,
    });

    return res.json({
      success: true,
      data: result.shift,
      reconciliation: result.reconciliation,
      message: 'Cashier shift closed and cash drawer reconciled successfully.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'SHIFT_CLOSE_FAILED', message: err.message },
    });
  }
};

export const executePosSale = async (req, res) => {
  try {
    const { shiftId, items, customer, payment, manualDiscount, notes } = req.body || {};
    const idempotencyKey = req.headers['idempotency-key'] || req.body?.idempotencyKey;

    const result = await createPosSale({
      tenantId: req.tenantId,
      cashierId: req.user?._id,
      shiftId,
      items,
      customer,
      payment,
      manualDiscount,
      notes,
      idempotencyKey,
    });

    return res.status(result.isDuplicate ? 200 : 201).json({
      success: true,
      data: result.order,
      receipt: result.receipt,
      shift: result.shift,
      isDuplicate: result.isDuplicate,
      message: result.isDuplicate ? 'Duplicate POS sale recognized.' : 'POS sale completed successfully.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'POS_SALE_FAILED', message: err.message },
    });
  }
};

