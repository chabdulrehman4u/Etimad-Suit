import mongoose from 'mongoose';

const customDomainSchema = new mongoose.Schema(
  {
    domain: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: String,
    verifiedAt: Date,
    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const tenantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    subdomain: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    customDomains: [customDomainSchema],
    status: {
      type: String,
      enum: ['active', 'suspended', 'trial', 'cancelled'],
      default: 'trial',
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
    },
    settings: {
      currency: {
        type: String,
        default: 'PKR',
      },
      currencySymbol: {
        type: String,
        default: 'Rs.',
      },
      timezone: {
        type: String,
        default: 'Asia/Karachi',
      },
      logoUrl: {
        type: String,
        default: '',
      },
      faviconUrl: {
        type: String,
        default: '',
      },
      primaryColor: {
        type: String,
        default: '#0284c7',
      },
      secondaryColor: {
        type: String,
        default: '#0f172a',
      },
      contactPhone: String,
      contactEmail: String,
      address: String,
    },
  },
  {
    timestamps: true,
  }
);

tenantSchema.index({ 'customDomains.domain': 1 }, { unique: true, sparse: true });

export const Tenant = mongoose.model('Tenant', tenantSchema);
export default Tenant;

