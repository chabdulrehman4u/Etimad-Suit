import { Product } from '../../backend/src/modules/products/Product.js';
import { StockLedger } from '../../backend/src/modules/inventory/StockLedger.js';

/**
 * Phase E: Taxonomies & Product Reconciliation Engine
 * Matches products across Ecommerce and IMS, resolves physical stock
 * and cost price from IMS with rich images and slugs from Ecommerce,
 * and initializes authoritative StockLedger opening movements.
 */
export const migrateTaxonomiesAndProducts = async ({
  legacyEcommerceProducts = [],
  legacyImsProducts = [],
  flagshipTenantId,
}) => {
  let matchedCount = 0;
  let imsOnlyCount = 0;
  let ecommerceOnlyCount = 0;

  // Build lookups for IMS products
  const imsByBarcode = new Map();
  const imsByModel = new Map();
  const imsByName = new Map();

  for (const ims of legacyImsProducts) {
    if (ims.barcode) imsByBarcode.set(String(ims.barcode).trim(), ims);
    if (ims.model || ims.sku) imsByModel.set(String(ims.model || ims.sku).trim().toUpperCase(), ims);
    if (ims.name || ims.title) imsByName.set(String(ims.name || ims.title).trim().toLowerCase(), ims);
  }

  const processedImsIds = new Set();
  const productMap = new Map(); // identifier -> Product doc

  // 2. Iterate through Ecommerce products and attempt matching
  for (const ecom of legacyEcommerceProducts) {
    const ecomBarcode = ecom.barcode ? String(ecom.barcode).trim() : null;
    const ecomModel = ecom.model || ecom.sku ? String(ecom.model || ecom.sku).trim().toUpperCase() : null;
    const ecomName = String(ecom.name || ecom.title || '').trim().toLowerCase();

    // Match priority: 1) Barcode -> 2) Model/SKU -> 3) Normalized Name
    let matchedIms = null;
    if (ecomBarcode && imsByBarcode.has(ecomBarcode)) {
      matchedIms = imsByBarcode.get(ecomBarcode);
    } else if (ecomModel && imsByModel.has(ecomModel)) {
      matchedIms = imsByModel.get(ecomModel);
    } else if (ecomName && imsByName.has(ecomName)) {
      matchedIms = imsByName.get(ecomName);
    }

    let finalName = ecom.name || ecom.title || (matchedIms?.name || 'Migrated Product');
    let finalSku = ecom.sku || matchedIms?.sku || matchedIms?.model || `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    let finalBarcode = ecomBarcode || matchedIms?.barcode || undefined;
    let finalSlug = String(ecom.slug || finalName).toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

    // Physical stock & authoritative cost from IMS, retail from Ecommerce/IMS
    const finalStock = matchedIms ? (matchedIms.stock ?? matchedIms.quantity ?? 0) : (ecom.stock ?? ecom.quantity ?? 0);
    const finalCostPrice = matchedIms ? (matchedIms.originalPrice ?? matchedIms.costPrice ?? 0) : (ecom.costPrice ?? 0);
    const finalRetailPrice = ecom.retailPrice ?? ecom.price ?? (matchedIms?.retailPrice || 0);
    const finalWholesalePrice = matchedIms?.wholesalePrice ?? (finalRetailPrice * 0.8);

    // Rich images from Ecommerce
    const images = Array.isArray(ecom.images) && ecom.images.length > 0
      ? ecom.images.map((img, idx) => ({
          url: typeof img === 'string' ? img : (img.url || ''),
          alt: img.alt || finalName,
          isPrimary: idx === 0,
        }))
      : [];

    if (matchedIms) {
      matchedCount++;
      processedImsIds.add(matchedIms._id?.toString() || matchedIms.id || matchedIms.barcode);
    } else {
      ecommerceOnlyCount++;
    }

    // Upsert Product record
    let product = await Product.findOne({
      tenantId: flagshipTenantId,
      $or: [
        { sku: finalSku },
        { slug: finalSlug },
        ...(finalBarcode ? [{ barcode: finalBarcode }] : []),
      ],
    });

    if (!product) {
      product = new Product({
        tenantId: flagshipTenantId,
        name: finalName,
        slug: finalSlug,
        sku: finalSku,
        barcode: finalBarcode,
        description: ecom.description || ecom.longDescription || '',
        pricing: {
          costPrice: Math.max(0, Number(finalCostPrice) || 0),
          retailPrice: Math.max(0, Number(finalRetailPrice) || 0),
          wholesalePrice: Math.max(0, Number(finalWholesalePrice) || 0),
        },
        stock: Math.max(0, Number(finalStock) || 0),
        images,
        isOnlineAvailable: true,
        isPosAvailable: true,
        isWholesaleAvailable: true,
      });
      await product.save();
    } else {
      // Reconcile values
      product.stock = Math.max(0, Number(finalStock) || 0);
      product.pricing.costPrice = Math.max(0, Number(finalCostPrice) || 0);
      product.pricing.retailPrice = Math.max(0, Number(finalRetailPrice) || 0);
      if (images.length > 0 && product.images.length === 0) product.images = images;
      await product.save();
    }

    productMap.set(product._id.toString(), product);

    // Initial Stock Ledger Record (Idempotent)
    const existingLedger = await StockLedger.findOne({
      tenantId: flagshipTenantId,
      productId: product._id,
      reason: /migration/i,
    });

    if (!existingLedger && product.stock > 0) {
      const entry = new StockLedger({
        tenantId: flagshipTenantId,
        productId: product._id,
        type: 'ADJUSTMENT',
        delta: product.stock,
        quantity: product.stock,
        previousStock: 0,
        newStock: product.stock,
        reason: 'Historical migration opening inventory balance',
        referenceModel: 'Manual',
        referenceId: `MIG-${product._id}`,
      });
      await entry.save();
    }
  }

  // 3. Import remaining IMS-only products (not matched in Ecommerce)
  for (const ims of legacyImsProducts) {
    const imsId = ims._id?.toString() || ims.id || ims.barcode;
    if (processedImsIds.has(imsId)) continue;

    imsOnlyCount++;
    const finalName = ims.name || ims.title || 'IMS Stock Product';
    const finalSku = ims.sku || ims.model || `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const finalBarcode = ims.barcode ? String(ims.barcode).trim() : undefined;
    const finalSlug = String(ims.slug || finalName).toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    const finalStock = ims.stock ?? ims.quantity ?? 0;
    const finalCostPrice = ims.originalPrice ?? ims.costPrice ?? 0;
    const finalRetailPrice = ims.retailPrice || 0;
    const finalWholesalePrice = ims.wholesalePrice ?? (finalRetailPrice * 0.8);

    let product = await Product.findOne({
      tenantId: flagshipTenantId,
      $or: [
        { sku: finalSku },
        { slug: finalSlug },
        ...(finalBarcode ? [{ barcode: finalBarcode }] : []),
      ],
    });

    if (!product) {
      product = new Product({
        tenantId: flagshipTenantId,
        name: finalName,
        slug: finalSlug,
        sku: finalSku,
        barcode: finalBarcode,
        pricing: {
          costPrice: Math.max(0, Number(finalCostPrice) || 0),
          retailPrice: Math.max(0, Number(finalRetailPrice) || 0),
          wholesalePrice: Math.max(0, Number(finalWholesalePrice) || 0),
        },
        stock: Math.max(0, Number(finalStock) || 0),
        isOnlineAvailable: true,
        isPosAvailable: true,
        isWholesaleAvailable: true,
      });
      await product.save();
    }
    productMap.set(product._id.toString(), product);

    // Initial Stock Ledger Record (Idempotent)
    const existingLedger = await StockLedger.findOne({
      tenantId: flagshipTenantId,
      productId: product._id,
      reason: /migration/i,
    });

    if (!existingLedger && product.stock > 0) {
      const entry = new StockLedger({
        tenantId: flagshipTenantId,
        productId: product._id,
        type: 'ADJUSTMENT',
        delta: product.stock,
        quantity: product.stock,
        previousStock: 0,
        newStock: product.stock,
        reason: 'Historical migration opening inventory balance',
        referenceModel: 'Manual',
        referenceId: `MIG-${product._id}`,
      });
      await entry.save();
    }
  }

  // Calculate totals across flagship catalog
  const allProducts = await Product.find({ tenantId: flagshipTenantId });
  const totalStockUnits = allProducts.reduce((sum, p) => sum + (p.stock || 0), 0);
  const totalStockValuation = allProducts.reduce((sum, p) => sum + ((p.stock || 0) * (p.pricing?.costPrice || 0)), 0);

  return {
    matchedCount,
    imsOnlyCount,
    ecommerceOnlyCount,
    totalProducts: allProducts.length,
    totalStockUnits,
    totalStockValuation,
    productMap,
  };
};
