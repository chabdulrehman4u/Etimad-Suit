import mongoose from 'mongoose';

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    price: {
      monthly: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },
      yearly: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },
      currency: {
        type: String,
        default: 'PKR',
      },
    },
    quotas: {
      maxProducts: {
        type: Number,
        default: 100, // -1 means unlimited
      },
      maxStaff: {
        type: Number,
        default: 3, // -1 means unlimited
      },
      maxOrdersPerMonth: {
        type: Number,
        default: 500, // -1 means unlimited
      },
      maxWarehouses: {
        type: Number,
        default: 1,
      },
    },
    features: {
      customDomainAllowed: {
        type: Boolean,
        default: false,
      },
      appsAccessAllowed: {
        type: Boolean,
        default: false,
      },
      posAllowed: {
        type: Boolean,
        default: true,
      },
      wholesaleAllowed: {
        type: Boolean,
        default: false,
      },
      analyticsAdvanced: {
        type: Boolean,
        default: false,
      },
      prioritySupport: {
        type: Boolean,
        default: false,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    trialDays: {
      type: Number,
      default: 14,
    },
  },
  {
    timestamps: true,
  }
);

export const Plan = mongoose.model('Plan', planSchema);
export default Plan;

