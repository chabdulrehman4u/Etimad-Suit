import { Product } from '../products/Product.js';
import { StockLedger } from './StockLedger.js';
import { adjustStock } from './inventoryService.js';

/**
 * 1. Get Live Inventory Balances & Low Stock Alerts
 */
export const getBalances = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const query = req.scopeTenant({});

    if (req.query.lowStock === 'true') {
      query.$expr = { $lte: ['$stock', '$lowStockThreshold'] };
    }

    if (req.query.search) {
      const term = String(req.query.search).trim();
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { sku: term },
        { barcode: term },
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(query).sort({ stock: 1 }).skip(skip).limit(limit),
      Product.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: products.map((p) => ({
        productId: p._id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        model: p.model,
        category: p.category,
        stock: p.stock,
        lowStockThreshold: p.lowStockThreshold,
        isLowStock: p.stock <= p.lowStockThreshold,
        pricing: p.pricing,
      })),
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
      error: { code: 'BALANCE_FETCH_FAILED', message: err.message },
    });
  }
};

/**
 * 2. Get Immutable Stock Ledger Audit Trail
 */
export const getLedger = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const query = req.scopeTenant({});

    if (req.query.productId) {
      query.productId = req.query.productId;
    }

    if (req.query.type) {
      query.type = req.query.type;
    }

    const [entries, total] = await Promise.all([
      StockLedger.find(query)
        .populate('productId', 'name sku barcode')
        .populate('actorId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      StockLedger.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: entries,
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
      error: { code: 'LEDGER_FETCH_FAILED', message: err.message },
    });
  }
};

/**
 * 3. Manual Stock Adjustment with Actor Audit
 */
export const executeAdjustment = async (req, res) => {
  try {
    const { productId, newStock, reason, notes } = req.body || {};

    if (!productId || newStock == null || !reason) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'productId, newStock, and reason are required.' },
      });
    }

    const result = await adjustStock({
      tenantId: req.tenantId,
      productId,
      newStock,
      reason,
      actorId: req.user?._id,
      notes,
    });

    return res.json({
      success: true,
      data: result,
      message: 'Stock adjusted successfully.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'ADJUSTMENT_FAILED', message: err.message },
    });
  }
};

