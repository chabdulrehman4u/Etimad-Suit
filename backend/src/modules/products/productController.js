import mongoose from 'mongoose';
import { Product } from './Product.js';

/**
 * 1. List Products (Strictly scoped to authenticated tenant)
 */
export const listProducts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = req.scopeTenant({});

    if (req.query.search) {
      const term = String(req.query.search).trim();
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { model: { $regex: term, $options: 'i' } },
        { barcode: term },
        { sku: term },
      ];
    }

    if (req.query.category) {
      query.category = req.query.category;
    }

    const [products, total] = await Promise.all([
      Product.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Product.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: products,
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
 * 2. Create Product (Enforces tenant scoping)
 */
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      slug,
      sku,
      barcode,
      model,
      category,
      description,
      pricing,
      stock = 0,
      isOnlineAvailable,
      isPosAvailable,
      isWholesaleAvailable,
      images,
    } = req.body || {};

    if (!name || !pricing || pricing.retailPrice == null) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Product name and retail price are required.' },
      });
    }

    const cleanSlug = String(slug || name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-');

    // Check slug collision within this tenant
    const existingSlug = await Product.findOne(req.scopeTenant({ slug: cleanSlug }));
    if (existingSlug) {
      return res.status(409).json({
        success: false,
        error: { code: 'SLUG_IN_USE', message: 'A product with this slug already exists in your store.' },
      });
    }

    // Check barcode collision within this tenant
    if (barcode) {
      const existingBarcode = await Product.findOne(req.scopeTenant({ barcode: String(barcode).trim() }));
      if (existingBarcode) {
        return res.status(409).json({
          success: false,
          error: { code: 'BARCODE_IN_USE', message: 'A product with this barcode already exists in your store.' },
        });
      }
    }

    const product = new Product({
      tenantId: req.tenantId, // Strict server-side injection
      name: String(name).trim(),
      slug: cleanSlug,
      sku: sku ? String(sku).trim() : undefined,
      barcode: barcode ? String(barcode).trim() : undefined,
      model: model ? String(model).trim() : undefined,
      category: category || 'General',
      description: description || '',
      pricing: {
        costPrice: Number(pricing.costPrice || 0),
        retailPrice: Number(pricing.retailPrice),
        websitePrice: Number(pricing.websitePrice || pricing.retailPrice),
        wholesalePrice: Number(pricing.wholesalePrice || pricing.retailPrice),
        minWholesaleQty: Number(pricing.minWholesaleQty || 6),
      },
      stock: Math.max(0, Number(stock || 0)),
      isOnlineAvailable: isOnlineAvailable !== false,
      isPosAvailable: isPosAvailable !== false,
      isWholesaleAvailable: isWholesaleAvailable !== false,
      images: Array.isArray(images) ? images : [],
    });

    await product.save();

    return res.status(201).json({
      success: true,
      data: product,
      message: 'Product created successfully.',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'CREATE_FAILED', message: err.message },
    });
  }
};

/**
 * 3. Get Product By ID (Tenant Isolated)
 */
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Malformed product ID.' },
      });
    }

    // Strict tenant scoping in query:
    const product = await Product.findOne(req.scopeTenant({ _id: id }));
    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found.' },
      });
    }

    return res.json({
      success: true,
      data: product,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: err.message },
    });
  }
};

/**
 * 4. Update Product (Tenant Isolated)
 */
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Malformed product ID.' },
      });
    }

    const product = await Product.findOne(req.scopeTenant({ _id: id }));
    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found in this store.' },
      });
    }

    const updates = req.body || {};
    if (updates.name) product.name = String(updates.name).trim();
    if (updates.model) product.model = String(updates.model).trim();
    if (updates.category) product.category = updates.category;
    if (updates.description != null) product.description = updates.description;
    if (updates.pricing) {
      product.pricing = {
        ...product.pricing.toObject(),
        ...updates.pricing,
      };
    }
    if (updates.stock != null) product.stock = Math.max(0, Number(updates.stock));
    if (updates.isOnlineAvailable != null) product.isOnlineAvailable = Boolean(updates.isOnlineAvailable);
    if (updates.isPosAvailable != null) product.isPosAvailable = Boolean(updates.isPosAvailable);
    if (updates.isWholesaleAvailable != null) product.isWholesaleAvailable = Boolean(updates.isWholesaleAvailable);
    if (Array.isArray(updates.images)) product.images = updates.images;

    await product.save();

    return res.json({
      success: true,
      data: product,
      message: 'Product updated successfully.',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: err.message },
    });
  }
};

/**
 * 5. Delete Product (Tenant Isolated)
 */
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Malformed product ID.' },
      });
    }

    const result = await Product.findOneAndDelete(req.scopeTenant({ _id: id }));
    if (!result) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found or belongs to another merchant.' },
      });
    }

    return res.json({
      success: true,
      message: 'Product deleted successfully.',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'DELETE_FAILED', message: err.message },
    });
  }
};

