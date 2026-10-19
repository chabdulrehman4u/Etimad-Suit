import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
    },
    barcode: {
      type: String,
      trim: true,
    },
    model: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      default: 'General',
    },
    description: {
      type: String,
      default: '',
    },
    pricing: {
      costPrice: {
        type: Number,
        default: 0,
        min: 0,
      },
      retailPrice: {
        type: Number,
        required: true,
        min: 0,
      },
      websitePrice: {
        type: Number,
        default: 0,
        min: 0,
      },
      wholesalePrice: {
        type: Number,
        default: 0,
        min: 0,
      },
      minWholesaleQty: {
        type: Number,
        default: 6,
        min: 1,
      },
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
    },
    isOnlineAvailable: {
      type: Boolean,
      default: true,
    },
    isPosAvailable: {
      type: Boolean,
      default: true,
    },
    isWholesaleAvailable: {
      type: Boolean,
      default: true,
    },
    freeShipping: {
      type: Boolean,
      default: false,
    },
    deliveryCharges: {
      type: Number,
      default: 0,
      min: 0,
    },
    images: [
      {
        url: { type: String, required: true },
        public_id: String,
        alt: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound Tenant-Scoped Unique Constraints
productSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
productSchema.index(
  { tenantId: 1, barcode: 1 },
  {
    unique: true,
    partialFilterExpression: { barcode: { $type: 'string' } },
  }
);
productSchema.index(
  { tenantId: 1, sku: 1 },
  {
    unique: true,
    partialFilterExpression: { sku: { $type: 'string' } },
  }
);
productSchema.index({ tenantId: 1, name: 'text', model: 'text' });

export const Product = mongoose.model('Product', productSchema);
export default Product;

