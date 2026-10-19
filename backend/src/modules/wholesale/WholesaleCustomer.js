import mongoose from 'mongoose';

const wholesaleCustomerSchema = new mongoose.Schema(
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
    companyName: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    address: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      default: '',
    },
    creditLimit: {
      type: Number,
      default: 0, // Maximum allowed outstanding debt
      min: 0,
    },
    creditTermsDays: {
      type: Number,
      default: 30, // e.g. Net 30 days
      min: 0,
    },
    outstandingBalance: {
      type: Number,
      default: 0, // Live customer khata debt owed to the merchant
      min: 0,
    },
    priceTier: {
      type: String,
      enum: ['standard', 'tier_1', 'tier_2', 'vip'],
      default: 'standard',
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

wholesaleCustomerSchema.index({ tenantId: 1, phone: 1 });
wholesaleCustomerSchema.index({ tenantId: 1, name: 1 });

export const WholesaleCustomer = mongoose.model('WholesaleCustomer', wholesaleCustomerSchema);
export default WholesaleCustomer;

