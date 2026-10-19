import mongoose from 'mongoose';

const quotationItemSchema = new mongoose.Schema(
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
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const quotationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    quotationNumber: {
      type: String,
      required: true,
      trim: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WholesaleCustomer',
      required: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      required: true,
      trim: true,
    },
    items: [quotationItemSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discountTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    validUntil: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'converted', 'expired', 'rejected'],
      default: 'draft',
      index: true,
    },
    convertedOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    notes: {
      type: String,
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

quotationSchema.index({ tenantId: 1, quotationNumber: 1 }, { unique: true });
quotationSchema.index({ tenantId: 1, customerId: 1, createdAt: -1 });
quotationSchema.index({ tenantId: 1, status: 1 });

export const Quotation = mongoose.model('Quotation', quotationSchema);
export default Quotation;

