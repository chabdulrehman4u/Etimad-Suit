import mongoose from 'mongoose';

const parcelSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
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
    trackingNumber: {
      type: String,
      required: true,
      trim: true,
    },
    courier: {
      type: String,
      enum: ['lcs', 'postex', 'mnp', 'trax', 'manual'],
      default: 'manual',
    },
    codAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    customer: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      address: { type: String, default: '' },
      city: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['booked', 'dispatched', 'in_transit', 'delivered', 'returned', 'cancelled'],
      default: 'booked',
      index: true,
    },
    dispatchedAt: Date,
    deliveredAt: Date,
    returnedAt: Date,
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

parcelSchema.index({ tenantId: 1, trackingNumber: 1 }, { unique: true });
parcelSchema.index({ tenantId: 1, status: 1 });
parcelSchema.index({ tenantId: 1, orderId: 1 });

export const Parcel = mongoose.model('Parcel', parcelSchema);
export default Parcel;
