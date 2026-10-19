import mongoose from 'mongoose';

export const ACCOUNT_TYPES = {
  // ASSETS (Normal balance: DEBIT)
  CASH: 'cash',
  BANK: 'bank',
  ACCOUNTS_RECEIVABLE: 'accounts_receivable',
  INVENTORY: 'inventory',

  // LIABILITIES (Normal balance: CREDIT)
  ACCOUNTS_PAYABLE: 'accounts_payable',

  // EQUITY (Normal balance: CREDIT)
  OWNERS_EQUITY: 'owners_equity',

  // REVENUE (Normal balance: CREDIT)
  SALES_REVENUE: 'sales_revenue',

  // EXPENSES (Normal balance: DEBIT)
  COGS: 'cogs',
  FREIGHT_EXPENSE: 'freight_expense',
  OPERATING_EXPENSE: 'operating_expense',
  DAMAGE_EXPENSE: 'damage_expense',
};

const financeLedgerSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    entryNumber: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'OWNER_INVESTMENT',
        'OWNER_WITHDRAWAL',
        'PURCHASE_RECEIPT',
        'SUPPLIER_PAYMENT',
        'SALE_ORDER',
        'CUSTOMER_PAYMENT',
        'EXPENSE',
        'BANK_TRANSFER',
        'INVENTORY_ADJUSTMENT',
        'RETURN_REFUND',
        'DAMAGE_WRITEOFF',
      ],
      required: true,
      index: true,
    },
    // Double-Entry Balance: Debit Account increases Assets/Expenses, decreases Liabilities/Equity
    debitAccount: {
      type: String,
      enum: Object.values(ACCOUNT_TYPES),
      required: true,
      index: true,
    },
    // Double-Entry Balance: Credit Account increases Liabilities/Equity/Revenue, decreases Assets
    creditAccount: {
      type: String,
      enum: Object.values(ACCOUNT_TYPES),
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    referenceModel: {
      type: String,
      enum: ['Order', 'PurchaseBatch', 'Expense', 'Return', 'SupplierPayment', 'Manual'],
      default: 'Manual',
    },
    referenceId: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    isVoided: {
      type: Boolean,
      default: false,
      index: true,
    },
    voidReason: {
      type: String,
      trim: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Compound Indexes for fast reporting and ledger audits
financeLedgerSchema.index({ tenantId: 1, createdAt: -1 });
financeLedgerSchema.index({ tenantId: 1, entryNumber: 1 }, { unique: true });
financeLedgerSchema.index({ tenantId: 1, referenceModel: 1, referenceId: 1 });

export const FinanceLedger = mongoose.model('FinanceLedger', financeLedgerSchema);
export default FinanceLedger;
