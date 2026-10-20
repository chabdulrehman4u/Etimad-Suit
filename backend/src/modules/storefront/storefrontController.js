import {
  getOrCreateTheme,
  updateTheme,
  updateDraftSections,
  publishHomepage,
  toggleFeature,
  getPublicStorefrontBundle,
} from './storefrontService.js';
import { Product } from '../products/Product.js';
import { Order } from '../orders/Order.js';
import { calculateOrderPricing } from '../orders/pricingService.js';
import { createCanonicalOrder } from '../orders/orderService.js';
import { StorefrontTheme } from './StorefrontTheme.js';

/**
 * 1. Public Storefront Configuration
 * Publicly accessible by storefront frontend to render theme, layout, and feature flags
 */
export const getPublicConfig = async (req, res) => {
  try {
    const bundle = await getPublicStorefrontBundle(req.tenantId);
    return res.json({
      success: true,
      data: bundle,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'CONFIG_FETCH_FAILED', message: err.message },
    });
  }
};

/**
 * 2. Get Merchant Theme (including Draft & Published layout states)
 */
export const getTheme = async (req, res) => {
  try {
    const theme = await getOrCreateTheme(req.tenantId);
    return res.json({
      success: true,
      data: theme,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'THEME_FETCH_FAILED', message: err.message },
    });
  }
};

/**
 * 3. Update Theme (Colors, Footer, Topbar, Branding, Typography, Features)
 */
export const updateThemeSettings = async (req, res) => {
  try {
    const updatedTheme = await updateTheme(req.tenantId, req.body || {});
    return res.json({
      success: true,
      data: updatedTheme,
      message: 'Storefront theme and design updated successfully.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'THEME_UPDATE_FAILED', message: err.message },
    });
  }
};

/**
 * 4. Update Draft Homepage Sections (Reorder / add / remove / configure blocks)
 */
export const updateSections = async (req, res) => {
  try {
    const { sections } = req.body || {};
    if (!sections || !Array.isArray(sections)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Sections array is required.' },
      });
    }

    const draftSections = await updateDraftSections(req.tenantId, sections);
    return res.json({
      success: true,
      data: draftSections,
      message: 'Draft homepage sections saved successfully. Publish to apply to live storefront.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'SECTIONS_UPDATE_FAILED', message: err.message },
    });
  }
};

/**
 * 5. Publish Homepage Layout (Draft -> Live)
 */
export const publishThemeLayout = async (req, res) => {
  try {
    const result = await publishHomepage(req.tenantId);
    return res.json({
      success: true,
      data: result,
      message: 'Homepage layout published to live storefront successfully.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'PUBLISH_FAILED', message: err.message },
    });
  }
};

/**
 * 6. Quick Real-Time Feature Flag Toggle
 */
export const updateFeatureFlag = async (req, res) => {
  try {
    const { featureKey } = req.params;
    const { enabled } = req.body || {};

    if (enabled == null) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELD', message: '"enabled" boolean field is required.' },
      });
    }

    const result = await toggleFeature(req.tenantId, featureKey, enabled);
    return res.json({
      success: true,
      data: result,
      message: `Feature flag "${featureKey}" updated to ${enabled}.`,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'FLAG_UPDATE_FAILED', message: err.message },
    });
  }
};

/**
 * 7. Public Storefront Product Catalog
 */
export const getPublicCatalog = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 24));
    const skip = (page - 1) * limit;

    const query = req.scopeTenant({ isOnlineAvailable: { $ne: false } });

    if (req.query.search) {
      const term = String(req.query.search).trim();
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
        { sku: term },
      ];
    }

    if (req.query.category) {
      query.category = req.query.category;
    }

    let sort = { createdAt: -1 };
    if (req.query.sort === 'price_asc') sort = { 'pricing.retailPrice': 1 };
    if (req.query.sort === 'price_desc') sort = { 'pricing.retailPrice': -1 };
    if (req.query.sort === 'name_asc') sort = { name: 1 };

    const [products, total] = await Promise.all([
      Product.find(query).sort(sort).skip(skip).limit(limit),
      Product.countDocuments(query),
    ]);

    // Format safe client-facing payload (exclude internal landed cost)
    const formatted = products.map((p) => ({
      _id: p._id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      category: p.category,
      description: p.description,
      pricing: {
        retailPrice: p.pricing.retailPrice,
        websitePrice: p.pricing.websitePrice || p.pricing.retailPrice,
      },
      stock: p.stock,
      isOutOfStock: p.stock <= 0,
      images: p.images,
      variants: p.variants,
    }));

    return res.json({
      success: true,
      data: formatted,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'CATALOG_FAILED', message: err.message },
    });
  }
};

/**
 * 8. Public Single Product Details
 */
export const getPublicProductDetails = async (req, res) => {
  try {
    const { identifier } = req.params;

    const query = req.scopeTenant({
      isOnlineAvailable: { $ne: false },
      $or: [
        { slug: identifier.toLowerCase().trim() },
        ...(identifier.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: identifier }] : []),
      ],
    });

    const product = await Product.findOne(query);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found in this store.' },
      });
    }

    return res.json({
      success: true,
      data: {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        category: product.category,
        description: product.description,
        pricing: {
          retailPrice: product.pricing.retailPrice,
          websitePrice: product.pricing.websitePrice || product.pricing.retailPrice,
        },
        stock: product.stock,
        isOutOfStock: product.stock <= 0,
        images: product.images,
        variants: product.variants,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'PRODUCT_FETCH_FAILED', message: err.message },
    });
  }
};

/**
 * 9. Authoritative Public Cart & Checkout Pricing Calculation
 */
export const calculatePublicCart = async (req, res) => {
  try {
    const { items = [], couponCode } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMPTY_CART', message: 'Cart items are required.' },
      });
    }

    const pricing = await calculateOrderPricing({
      tenantId: req.tenantId,
      channel: 'online',
      items,
      couponCode,
    });

    return res.json({
      success: true,
      data: pricing,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'CALCULATE_CART_FAILED', message: err.message },
    });
  }
};

/**
 * 10. Public Online Order Checkout
 */
export const createPublicOnlineOrder = async (req, res) => {
  try {
    const { customer, items, payment = { method: 'cod' }, couponCode, idempotencyKey } = req.body || {};

    // Validate theme feature flags
    const theme = await getOrCreateTheme(req.tenantId);
    if (payment.method === 'cod' && theme.features?.codAllowed === false) {
      return res.status(400).json({
        success: false,
        error: { code: 'COD_NOT_ALLOWED', message: 'Cash on Delivery is currently disabled by this store.' },
      });
    }

    const result = await createCanonicalOrder({
      tenantId: req.tenantId,
      channel: 'online',
      customer,
      items,
      payment: {
        method: payment.method || 'cod',
        status: 'unpaid',
      },
      couponCode,
      idempotencyKey,
    });

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      data: result.order,
      isDuplicate: result.isDuplicate,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'CHECKOUT_FAILED', message: err.message },
    });
  }
};

/**
 * 11. Public Customer Order Tracking
 */
export const trackPublicOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;

    const order = await Order.findOne(
      req.scopeTenant({ orderNumber: String(orderNumber).trim() })
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        error: { code: 'ORDER_NOT_FOUND', message: 'Order not found.' },
      });
    }

    return res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        channel: order.channel,
        createdAt: order.createdAt,
        fulfillmentStatus: order.fulfillment.status,
        courier: order.fulfillment.courier,
        paymentStatus: order.payment.status,
        paymentMethod: order.payment.method,
        grandTotal: order.financials.grandTotal,
        items: order.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          lineTotal: i.lineTotal,
        })),
        history: order.history,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'TRACK_FAILED', message: err.message },
    });
  }
};


