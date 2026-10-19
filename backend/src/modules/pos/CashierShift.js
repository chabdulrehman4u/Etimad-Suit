import mongoose from 'mongoose';

const cashierShiftSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    shiftNumber: {
      type: String,
      required: true,
      trim: true,
    },
    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    cashierName: {
      type: String,
      required: true,
      trim: true,
    },
    registerId: {
      type: String,
      default: 'REG-1',
      trim: true,
    },
    openingCash: {
      type: Number,
      required: true,
      min: 0,
    },
    openingTime: {
      type: Date,
      default: Date.now,
    },
    expectedCash: {
      type: Number,
      default: 0,
    },
    actualCash: {
      type: Number,
      default: 0,
    },
    cashDifference: {
      type: Number,
      default: 0, // actualCash - expectedCash (positive = surplus, negative = shortage)
    },
    totalCashSales: {
      type: Number,
      default: 0,
    },
    totalCardSales: {
      type: Number,
      default: 0,
    },
    totalSplitSales: {
      type: Number,
      default: 0,
    },
    totalSalesCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
      index: true,
    },
    closingTime: Date,
    closingNotes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

cashierShiftSchema.index({ tenantId: 1, shiftNumber: 1 }, { unique: true });
cashierShiftSchema.index({ tenantId: 1, cashierId: 1, status: 1 });
cashierShiftSchema.index({ tenantId: 1, registerId: 1, status: 1 });

export const CashierShift = mongoose.model('CashierShift', cashierShiftSchema);
export default CashierShift;

