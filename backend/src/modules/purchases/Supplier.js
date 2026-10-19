import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema(
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
    company: {
      type: String,
      trim: true,
      default: '',
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
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    payableBalance: {
      type: Number,
      default: 0, // Outstanding balance owed by merchant to this supplier
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

supplierSchema.index({ tenantId: 1, name: 1 });
supplierSchema.index({ tenantId: 1, phone: 1 });

export const Supplier = mongoose.model('Supplier', supplierSchema);
export default Supplier;
