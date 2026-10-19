import mongoose from 'mongoose';

const purchaseBatchItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    sku: {
      type: String,
      default: '',
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    courierExpensePerUnit: {
      type: Number,
      default: 0,
      min: 0,
    },
    effectiveCostPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const purchaseBatchSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    batchNumber: {
      type: String,
      required: true,
      trim: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    supplierName: {
      type: String,
      required: true,
      trim: true,
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
    },
    items: {
      type: [purchaseBatchItemSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'At least one item is required in a purchase order',
      },
    },
    itemsCost: {
      type: Number,
      required: true,
      min: 0,
    },
    courierExpense: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['paid', 'partially_paid', 'unpaid'],
      default: 'unpaid',
      index: true,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank', 'credit'],
      default: 'cash',
    },
    status: {
      type: String,
      enum: ['draft', 'received', 'cancelled'],
      default: 'draft',
      index: true,
    },
    receivedAt: Date,
    idempotencyKey: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Compound Indexes
purchaseBatchSchema.index({ tenantId: 1, batchNumber: 1 }, { unique: true });
purchaseBatchSchema.index({ tenantId: 1, supplierId: 1, createdAt: -1 });
purchaseBatchSchema.index({ tenantId: 1, status: 1 });
purchaseBatchSchema.index(
  { tenantId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  }
);

export const PurchaseBatch = mongoose.model('PurchaseBatch', purchaseBatchSchema);
export default PurchaseBatch;
