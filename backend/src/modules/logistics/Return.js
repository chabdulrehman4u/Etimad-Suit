import mongoose from 'mongoose';

const returnItemSchema = new mongoose.Schema(
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
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    condition: {
      type: String,
      enum: ['restockable', 'damaged', 'defective', 'wrong_item'],
      required: true,
    },
    actionTaken: {
      type: String,
      enum: ['restocked', 'written_off', 'pending'],
      default: 'pending',
    },
  },
  { _id: false }
);

const returnSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    returnNumber: {
      type: String,
      required: true,
      trim: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      trim: true,
    },
    parcelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Parcel',
    },
    trackingNumber: {
      type: String,
      default: '',
      trim: true,
    },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
    },
    items: [returnItemSchema],
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'inspected'],
      default: 'pending',
      index: true,
    },
    inspectorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    inspectedAt: Date,
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

returnSchema.index({ tenantId: 1, returnNumber: 1 }, { unique: true });
returnSchema.index({ tenantId: 1, orderId: 1 });
returnSchema.index({ tenantId: 1, status: 1 });

export const Return = mongoose.model('Return', returnSchema);
export default Return;
