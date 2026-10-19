import mongoose from 'mongoose';

const stockLedgerSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'PURCHASE_RECEIPT', // Inbound stock from supplier
        'SALE_DEDUCTION',   // Outbound stock from order (online, pos, wholesale)
        'STOCK_RESERVE',    // Temporarily held for checkout
        'STOCK_RELEASE',    // Released from cancelled checkout/order
        'RETURN_RESTOCK',   // Restocked from customer return
        'ADJUSTMENT',       // Manual audit count adjustment
        'TRANSFER',         // Warehouse transfer
      ],
      required: true,
      index: true,
    },
    delta: {
      type: Number,
      required: true, // Positive for inflow, negative for outflow
    },
    quantity: {
      type: Number,
      required: true,
      min: 1, // Absolute quantity of the movement
    },
    previousStock: {
      type: Number,
      required: true,
    },
    newStock: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    referenceModel: {
      type: String,
      enum: ['Order', 'PurchaseBatch', 'Return', 'Manual', 'Transfer'],
      required: true,
    },
    referenceId: {
      type: String,
      required: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: String,
  },
  {
    timestamps: true,
  }
);

// Compound indexes
stockLedgerSchema.index({ tenantId: 1, createdAt: -1 });
stockLedgerSchema.index({ tenantId: 1, productId: 1, createdAt: -1 });
stockLedgerSchema.index(
  { tenantId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  }
);

export const StockLedger = mongoose.model('StockLedger', stockLedgerSchema);
export default StockLedger;

