import express from 'express';
import {
  listJournalEntries,
  createManualEntry,
  makeSupplierPayment,
  addExpense,
  getBalances,
  getBalanceSheet,
  getIncomeStatement,
} from './financeController.js';
import { authenticate } from '../../middleware/auth.js';
import { resolveTenantContext } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../auth/roles.js';

const router = express.Router();

router.use(authenticate, resolveTenantContext);

// Ledger & Manual Transactions
router.get('/ledger', requirePermission(PERMISSIONS.FINANCE_READ), listJournalEntries);
router.post('/journal-entries', requirePermission(PERMISSIONS.FINANCE_WRITE), createManualEntry);

// Payments & Expenses
router.post('/supplier-payments', requirePermission(PERMISSIONS.FINANCE_WRITE), makeSupplierPayment);
router.post('/expenses', requirePermission(PERMISSIONS.FINANCE_WRITE), addExpense);

// Financial Reports
router.get('/balances', requirePermission(PERMISSIONS.FINANCE_READ), getBalances);
router.get('/balance-sheet', requirePermission(PERMISSIONS.FINANCE_READ), getBalanceSheet);
router.get('/income-statement', requirePermission(PERMISSIONS.FINANCE_READ), getIncomeStatement);

export default router;
