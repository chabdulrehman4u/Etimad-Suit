import mongoose from 'mongoose';
import { ROLES } from '../auth/roles.js';

const tenantMembershipSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
    },
    customPermissions: [
      {
        type: String,
      },
    ],
    status: {
      type: String,
      enum: ['active', 'invited', 'suspended'],
      default: 'active',
      index: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Compound Unique Index: A user can only have one membership per tenant
tenantMembershipSchema.index({ tenantId: 1, userId: 1 }, { unique: true });

export const TenantMembership = mongoose.model('TenantMembership', tenantMembershipSchema);
export default TenantMembership;

