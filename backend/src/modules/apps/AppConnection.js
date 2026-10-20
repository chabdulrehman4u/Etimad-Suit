import mongoose from 'mongoose';
import { encrypt, decrypt, maskSecret } from '../../utils/crypto.js';

const appConnectionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    providerId: {
      type: String,
      enum: ['lcs', 'postex', 'mnp', 'trax', 'stripe', 'jazzcash', 'easypaisa'],
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['courier', 'payment', 'marketing', 'sms'],
      required: true,
    },
    isEnabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    encryptedCredentials: {
      type: String,
      required: true,
    },
    settings: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ['connected', 'disconnected', 'error'],
      default: 'connected',
      index: true,
    },
    lastSyncAt: Date,
    lastError: {
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

appConnectionSchema.index({ tenantId: 1, providerId: 1 }, { unique: true });

// Methods for secure credentials handling
appConnectionSchema.methods.setCredentials = function (credentialsObj) {
  this.encryptedCredentials = encrypt(credentialsObj);
};

appConnectionSchema.methods.getDecryptedCredentials = function () {
  return decrypt(this.encryptedCredentials);
};

appConnectionSchema.methods.getMaskedCredentials = function () {
  const creds = this.getDecryptedCredentials() || {};
  const masked = {};
  for (const [key, val] of Object.entries(creds)) {
    masked[key] = maskSecret(val);
  }
  return masked;
};

export const AppConnection = mongoose.model('AppConnection', appConnectionSchema);
export default AppConnection;

