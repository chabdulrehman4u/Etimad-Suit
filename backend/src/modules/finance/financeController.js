import { FinanceLedger } from './FinanceLedger.js';
import {
  recordDoubleEntry,
  recordSupplierPayment,
  recordExpense,
  calculateAccountBalances,
  generateBalanceSheet,
  generateIncomeStatement,
} from './financeService.js';

export const listJournalEntries = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const query = req.scopeTenant({});
    if (req.query.account) {
      query.$or = [{ debitAccount: req.query.account }, { creditAccount: req.query.account }];
    }
    if (req.query.type) {
      query.type = req.query.type;
    }

    const [entries, total] = await Promise.all([
      FinanceLedger.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      FinanceLedger.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: entries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'LEDGER_FETCH_FAILED', message: err.message },
    });
  }
};

export const createManualEntry = async (req, res) => {
  try {
    const { type = 'ADJUSTMENT', debitAccount, creditAccount, amount, description, referenceId } = req.body || {};

    const entry = await recordDoubleEntry({
      tenantId: req.tenantId,
      type,
      debitAccount,
      creditAccount,
      amount,
      referenceModel: 'Manual',
      referenceId,
      description,
      actorId: req.user?._id,
    });

    return res.status(201).json({
      success: true,
      data: entry,
      message: 'Double-entry journal transaction recorded successfully.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'JOURNAL_ENTRY_FAILED', message: err.message },
    });
  }
};

export const makeSupplierPayment = async (req, res) => {
  try {
    const { supplierId, amount, paymentMethod, reference } = req.body || {};
    if (!supplierId || !amount) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'supplierId and amount are required.' },
      });
    }

    const result = await recordSupplierPayment({
      tenantId: req.tenantId,
      supplierId,
      amount,
      paymentMethod,
      reference,
      actorId: req.user?._id,
    });

    return res.json({
      success: true,
      data: result,
      message: 'Supplier payment recorded and khata balance adjusted.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'PAYMENT_FAILED', message: err.message },
    });
  }
};

export const addExpense = async (req, res) => {
  try {
    const { category, amount, paymentMethod, description, referenceId } = req.body || {};
    if (!amount || !description) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'amount and description are required.' },
      });
    }

    const entry = await recordExpense({
      tenantId: req.tenantId,
      category,
      amount,
      paymentMethod,
      description,
      referenceId,
      actorId: req.user?._id,
    });

    return res.status(201).json({
      success: true,
      data: entry,
      message: 'Expense recorded successfully in double-entry ledger.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'EXPENSE_FAILED', message: err.message },
    });
  }
};

export const getBalances = async (req, res) => {
  try {
    const balances = await calculateAccountBalances(req.tenantId);
    return res.json({
      success: true,
      data: balances,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'BALANCES_FETCH_FAILED', message: err.message },
    });
  }
};

export const getBalanceSheet = async (req, res) => {
  try {
    const report = await generateBalanceSheet(req.tenantId);
    return res.json({
      success: true,
      data: report,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'BALANCE_SHEET_FAILED', message: err.message },
    });
  }
};

export const getIncomeStatement = async (req, res) => {
  try {
    const report = await generateIncomeStatement(req.tenantId);
    return res.json({
      success: true,
      data: report,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'INCOME_STATEMENT_FAILED', message: err.message },
    });
  }
};

