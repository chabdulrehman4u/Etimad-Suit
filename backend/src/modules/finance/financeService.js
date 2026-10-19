import mongoose from 'mongoose';
import { FinanceLedger, ACCOUNT_TYPES } from './FinanceLedger.js';
import { Supplier } from '../purchases/Supplier.js';

// Generate sequential journal entry numbers
export const generateEntryNumber = async (tenantId) => {
  const year = new Date().getFullYear();
  const count = await FinanceLedger.countDocuments({ tenantId });
  const sequence = String(count + 1).padStart(5, '0');
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `JRN-${year}-${sequence}-${rand}`;
};

/**
 * 1. Core Double-Entry Transaction Engine
 * Mandate: For every entry, Debit Amount === Credit Amount
 */
export const recordDoubleEntry = async ({
  tenantId,
  type,
  debitAccount,
  creditAccount,
  amount,
  referenceModel = 'Manual',
  referenceId = '',
  description,
  actorId,
}) => {
  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    throw new Error('Transaction amount must be a positive number');
  }

  if (debitAccount === creditAccount) {
    throw new Error('Debit and Credit accounts must be distinct in double-entry bookkeeping');
  }

  if (!Object.values(ACCOUNT_TYPES).includes(debitAccount)) {
    throw new Error(`Invalid debit account: ${debitAccount}`);
  }

  if (!Object.values(ACCOUNT_TYPES).includes(creditAccount)) {
    throw new Error(`Invalid credit account: ${creditAccount}`);
  }

  const entryNumber = await generateEntryNumber(tenantId);

  const entry = new FinanceLedger({
    tenantId,
    entryNumber,
    type,
    debitAccount,
    creditAccount,
    amount: numAmount,
    referenceModel,
    referenceId: String(referenceId),
    description,
    actorId,
  });

  await entry.save();
  return entry;
};

/**
 * 2. Record Order Sale Financials
 * Balanced Double Entry:
 *   a) Revenue: Debit Cash/Bank/AR, Credit Sales Revenue
 *   b) COGS: Debit COGS, Credit Inventory Asset
 */
export const recordSaleFinancials = async ({
  tenantId,
  orderNumber,
  grandTotal,
  amountPaid,
  cogsTotal,
  paymentMethod = 'cash',
  actorId,
}) => {
  const entries = [];
  const cashOrBank = paymentMethod === 'bank' || paymentMethod === 'card' ? ACCOUNT_TYPES.BANK : ACCOUNT_TYPES.CASH;

  // A. Revenue Recognition
  const paid = Math.min(Number(amountPaid || 0), grandTotal);
  const receivable = Math.max(0, grandTotal - paid);

  if (paid > 0) {
    const entryPaid = await recordDoubleEntry({
      tenantId,
      type: 'SALE_ORDER',
      debitAccount: cashOrBank,
      creditAccount: ACCOUNT_TYPES.SALES_REVENUE,
      amount: paid,
      referenceModel: 'Order',
      referenceId: orderNumber,
      description: `Payment received for Order #${orderNumber} (${paymentMethod})`,
      actorId,
    });
    entries.push(entryPaid);
  }

  if (receivable > 0) {
    const entryAR = await recordDoubleEntry({
      tenantId,
      type: 'SALE_ORDER',
      debitAccount: ACCOUNT_TYPES.ACCOUNTS_RECEIVABLE,
      creditAccount: ACCOUNT_TYPES.SALES_REVENUE,
      amount: receivable,
      referenceModel: 'Order',
      referenceId: orderNumber,
      description: `Accounts receivable generated for Order #${orderNumber}`,
      actorId,
    });
    entries.push(entryAR);
  }

  // B. Cost of Goods Sold & Inventory Asset Reduction
  if (cogsTotal > 0) {
    const entryCogs = await recordDoubleEntry({
      tenantId,
      type: 'SALE_ORDER',
      debitAccount: ACCOUNT_TYPES.COGS,
      creditAccount: ACCOUNT_TYPES.INVENTORY,
      amount: cogsTotal,
      referenceModel: 'Order',
      referenceId: orderNumber,
      description: `COGS recognized for Order #${orderNumber}`,
      actorId,
    });
    entries.push(entryCogs);
  }

  return entries;
};

/**
 * 3. Record Inbound Purchase Batch Financials
 * Debit Inventory Asset, Credit Cash/Bank (paid) and Accounts Payable (credit)
 */
export const recordPurchaseFinancials = async ({
  tenantId,
  batchNumber,
  totalAmount,
  paidAmount = 0,
  remainingAmount = 0,
  paymentMethod = 'cash',
  actorId,
}) => {
  const entries = [];
  const cashOrBank = paymentMethod === 'bank' ? ACCOUNT_TYPES.BANK : ACCOUNT_TYPES.CASH;

  if (paidAmount > 0) {
    const paidEntry = await recordDoubleEntry({
      tenantId,
      type: 'PURCHASE_RECEIPT',
      debitAccount: ACCOUNT_TYPES.INVENTORY,
      creditAccount: cashOrBank,
      amount: paidAmount,
      referenceModel: 'PurchaseBatch',
      referenceId: batchNumber,
      description: `Inventory purchase #${batchNumber} paid via ${paymentMethod}`,
      actorId,
    });
    entries.push(paidEntry);
  }

  if (remainingAmount > 0) {
    const apEntry = await recordDoubleEntry({
      tenantId,
      type: 'PURCHASE_RECEIPT',
      debitAccount: ACCOUNT_TYPES.INVENTORY,
      creditAccount: ACCOUNT_TYPES.ACCOUNTS_PAYABLE,
      amount: remainingAmount,
      referenceModel: 'PurchaseBatch',
      referenceId: batchNumber,
      description: `Inventory purchase #${batchNumber} on credit (Accounts Payable)`,
      actorId,
    });
    entries.push(apEntry);
  }

  return entries;
};

/**
 * 4. Record Supplier Payment (Settling Accounts Payable / Khata)
 */
export const recordSupplierPayment = async ({
  tenantId,
  supplierId,
  amount,
  paymentMethod = 'cash',
  reference = '',
  actorId,
}) => {
  const supplier = await Supplier.findOne({ _id: supplierId, tenantId });
  if (!supplier) {
    throw new Error('Supplier not found in this store');
  }

  const numAmount = Number(amount);
  if (numAmount <= 0) {
    throw new Error('Payment amount must be greater than 0');
  }

  const cashOrBank = paymentMethod === 'bank' ? ACCOUNT_TYPES.BANK : ACCOUNT_TYPES.CASH;

  // Double entry: Debit Accounts Payable (liability decreases), Credit Cash/Bank (asset decreases)
  const entry = await recordDoubleEntry({
    tenantId,
    type: 'SUPPLIER_PAYMENT',
    debitAccount: ACCOUNT_TYPES.ACCOUNTS_PAYABLE,
    creditAccount: cashOrBank,
    amount: numAmount,
    referenceModel: 'SupplierPayment',
    referenceId: supplier._id.toString(),
    description: `Payment to supplier ${supplier.name} ${reference ? `(Ref: ${reference})` : ''}`,
    actorId,
  });

  // Reduce supplier's live khata balance
  supplier.payableBalance = Math.max(0, (supplier.payableBalance || 0) - numAmount);
  await supplier.save();

  return { entry, supplier };
};

/**
 * 5. Record Operating / General Expense
 */
export const recordExpense = async ({
  tenantId,
  category = ACCOUNT_TYPES.OPERATING_EXPENSE,
  amount,
  paymentMethod = 'cash',
  description,
  referenceId = '',
  actorId,
}) => {
  const cashOrBank = paymentMethod === 'bank' ? ACCOUNT_TYPES.BANK : ACCOUNT_TYPES.CASH;

  return recordDoubleEntry({
    tenantId,
    type: 'EXPENSE',
    debitAccount: category,
    creditAccount: cashOrBank,
    amount: Number(amount),
    referenceModel: 'Expense',
    referenceId,
    description: description || `Operating expense: ${category}`,
    actorId,
  });
};

/**
 * 6. Calculate Live Account Balances across Chart of Accounts
 */
export const calculateAccountBalances = async (tenantId) => {
  const entries = await FinanceLedger.find({ tenantId, isVoided: false });

  const balances = {
    [ACCOUNT_TYPES.CASH]: 0,
    [ACCOUNT_TYPES.BANK]: 0,
    [ACCOUNT_TYPES.ACCOUNTS_RECEIVABLE]: 0,
    [ACCOUNT_TYPES.INVENTORY]: 0,
    [ACCOUNT_TYPES.ACCOUNTS_PAYABLE]: 0,
    [ACCOUNT_TYPES.OWNERS_EQUITY]: 0,
    [ACCOUNT_TYPES.SALES_REVENUE]: 0,
    [ACCOUNT_TYPES.COGS]: 0,
    [ACCOUNT_TYPES.FREIGHT_EXPENSE]: 0,
    [ACCOUNT_TYPES.OPERATING_EXPENSE]: 0,
    [ACCOUNT_TYPES.DAMAGE_EXPENSE]: 0,
  };

  for (const entry of entries) {
    const { debitAccount, creditAccount, amount } = entry;

    // Normal DEBIT accounts (Assets & Expenses): +Debit, -Credit
    const isNormalDebit = [
      ACCOUNT_TYPES.CASH,
      ACCOUNT_TYPES.BANK,
      ACCOUNT_TYPES.ACCOUNTS_RECEIVABLE,
      ACCOUNT_TYPES.INVENTORY,
      ACCOUNT_TYPES.COGS,
      ACCOUNT_TYPES.FREIGHT_EXPENSE,
      ACCOUNT_TYPES.OPERATING_EXPENSE,
      ACCOUNT_TYPES.DAMAGE_EXPENSE,
    ].includes(debitAccount);

    if (isNormalDebit) {
      balances[debitAccount] = (balances[debitAccount] || 0) + amount;
    } else {
      balances[debitAccount] = (balances[debitAccount] || 0) - amount;
    }

    const isCreditNormalDebit = [
      ACCOUNT_TYPES.CASH,
      ACCOUNT_TYPES.BANK,
      ACCOUNT_TYPES.ACCOUNTS_RECEIVABLE,
      ACCOUNT_TYPES.INVENTORY,
      ACCOUNT_TYPES.COGS,
      ACCOUNT_TYPES.FREIGHT_EXPENSE,
      ACCOUNT_TYPES.OPERATING_EXPENSE,
      ACCOUNT_TYPES.DAMAGE_EXPENSE,
    ].includes(creditAccount);

    if (isCreditNormalDebit) {
      balances[creditAccount] = (balances[creditAccount] || 0) - amount;
    } else {
      balances[creditAccount] = (balances[creditAccount] || 0) + amount;
    }
  }

  return balances;
};

/**
 * 7. Real-Time Balance Sheet Generator (Assets = Liabilities + Equity)
 */
export const generateBalanceSheet = async (tenantId) => {
  const balances = await calculateAccountBalances(tenantId);

  // ASSETS
  const assets = {
    cash: balances[ACCOUNT_TYPES.CASH] || 0,
    bank: balances[ACCOUNT_TYPES.BANK] || 0,
    accountsReceivable: balances[ACCOUNT_TYPES.ACCOUNTS_RECEIVABLE] || 0,
    inventory: balances[ACCOUNT_TYPES.INVENTORY] || 0,
    totalAssets: 0,
  };
  assets.totalAssets = assets.cash + assets.bank + assets.accountsReceivable + assets.inventory;

  // LIABILITIES
  const liabilities = {
    accountsPayable: balances[ACCOUNT_TYPES.ACCOUNTS_PAYABLE] || 0,
    totalLiabilities: 0,
  };
  liabilities.totalLiabilities = liabilities.accountsPayable;

  // INCOME (Net Profit = Revenue - COGS - Expenses)
  const totalRevenue = balances[ACCOUNT_TYPES.SALES_REVENUE] || 0;
  const totalExpenses =
    (balances[ACCOUNT_TYPES.COGS] || 0) +
    (balances[ACCOUNT_TYPES.FREIGHT_EXPENSE] || 0) +
    (balances[ACCOUNT_TYPES.OPERATING_EXPENSE] || 0) +
    (balances[ACCOUNT_TYPES.DAMAGE_EXPENSE] || 0);

  const netIncome = totalRevenue - totalExpenses;

  // EQUITY (Owners Equity + Retained Earnings / Net Income)
  const ownersEquity = balances[ACCOUNT_TYPES.OWNERS_EQUITY] || 0;
  const totalEquity = ownersEquity + netIncome;

  const totalLiabilitiesAndEquity = liabilities.totalLiabilities + totalEquity;
  const isBalanced = Math.abs(assets.totalAssets - totalLiabilitiesAndEquity) < 0.01;

  return {
    assets,
    liabilities,
    equity: {
      ownersEquity,
      retainedEarnings: netIncome,
      totalEquity,
    },
    totalLiabilitiesAndEquity,
    isBalanced,
  };
};

/**
 * 8. Real-Time Profit & Loss (Income Statement) Generator
 */
export const generateIncomeStatement = async (tenantId) => {
  const balances = await calculateAccountBalances(tenantId);

  const salesRevenue = balances[ACCOUNT_TYPES.SALES_REVENUE] || 0;
  const cogs = balances[ACCOUNT_TYPES.COGS] || 0;
  const grossProfit = salesRevenue - cogs;

  const operatingExpenses = {
    freightExpense: balances[ACCOUNT_TYPES.FREIGHT_EXPENSE] || 0,
    generalOperatingExpense: balances[ACCOUNT_TYPES.OPERATING_EXPENSE] || 0,
    damageExpense: balances[ACCOUNT_TYPES.DAMAGE_EXPENSE] || 0,
    totalOperatingExpenses: 0,
  };
  operatingExpenses.totalOperatingExpenses =
    operatingExpenses.freightExpense +
    operatingExpenses.generalOperatingExpense +
    operatingExpenses.damageExpense;

  const netIncome = grossProfit - operatingExpenses.totalOperatingExpenses;

  return {
    revenue: {
      salesRevenue,
      totalRevenue: salesRevenue,
    },
    costOfGoodsSold: {
      cogs,
    },
    grossProfit,
    operatingExpenses,
    netIncome,
  };
};

