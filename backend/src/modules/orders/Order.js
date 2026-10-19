import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
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
    sku: String,
    model: String,
    category: String,
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPriceSnapshot: {
      type: Number,
      required: true,
      min: 0,
    },
    unitCostSnapshot: {
      type: Number,
      required: true,
      min: 0,
    },
    lineDiscount: {
      type: Number,
      default: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      trim: true,
    },
    channel: {
      type: String,
      enum: ['online', 'retail', 'wholesale'],
      required: true,
      index: true,
    },
    customer: {
      customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
      },
      name: {
        type: String,
        required: true,
        trim: true,
      },
      phone: {
        type: String,
        required: true,
        trim: true,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
      },
      shippingAddress: {
        street: String,
        city: String,
        province: String,
        postalCode: String,
      },
    },
    items: [orderItemSchema],
    financials: {
      subtotal: {
        type: Number,
        required: true,
        min: 0,
      },
      shippingFee: {
        type: Number,
        default: 0,
        min: 0,
      },
      discountTotal: {
        type: Number,
        default: 0,
        min: 0,
      },
      taxTotal: {
        type: Number,
        default: 0,
        min: 0,
      },
      grandTotal: {
        type: Number,
        required: true,
        min: 0,
      },
      amountPaid: {
        type: Number,
        default: 0,
        min: 0,
      },
      outstandingBalance: {
        type: Number,
        default: 0,
      },
      cogsTotal: {
        type: Number,
        required: true,
        min: 0,
      },
      grossProfit: {
        type: Number,
        required: true,
      },
    },
    payment: {
      method: {
        type: String,
        enum: ['cod', 'cash', 'card', 'bank_transfer', 'credit'],
        required: true,
      },
      status: {
        type: String,
        enum: ['unpaid', 'partially_paid', 'paid', 'refunded'],
        default: 'unpaid',
        index: true,
      },
      paidAt: Date,
      notes: String,
    },
    fulfillment: {
      status: {
        type: String,
        enum: [
          'pending',
          'confirmed',
          'processing',
          'packed',
          'dispatched',
          'delivered',
          'returned',
          'cancelled',
        ],
        default: 'pending',
        index: true,
      },
      courier: {
        provider: String,
        trackingNumber: String,
        bookingRef: String,
        dispatchedAt: Date,
        deliveredAt: Date,
      },
    },
    idempotencyKey: {
      type: String,
      trim: true,
    },
    history: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: String,
      },
    ],
    notes: String,
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Compound Unique Indexes
orderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });
orderSchema.index(
  { tenantId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  }
);
orderSchema.index({ tenantId: 1, channel: 1, createdAt: -1 });

export const Order = mongoose.model('Order', orderSchema);
export default Order;
