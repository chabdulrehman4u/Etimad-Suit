/**
 * Authoritative Constants and Types for Etimad Suit SaaS
 */

export const ORDER_CHANNELS = {
  ONLINE: 'online',
  RETAIL: 'retail',
  WHOLESALE: 'wholesale',
};

export const ORDER_STATUSES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  PACKED: 'packed',
  DISPATCHED: 'dispatched',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
};

export const PAYMENT_METHODS = {
  COD: 'cod',
  CASH: 'cash',
  CARD: 'card',
  BANK_TRANSFER: 'bank_transfer',
  CREDIT: 'credit',
};

export const PAYMENT_STATUSES = {
  UNPAID: 'unpaid',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
  REFUNDED: 'refunded',
};

export const TENANT_STATUSES = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  TRIAL: 'trial',
  CANCELLED: 'cancelled',
};

export const STOCK_MOVEMENT_TYPES = {
  PURCHASE_RECEIPT: 'PURCHASE_RECEIPT',
  SALE_DEDUCTION: 'SALE_DEDUCTION',
  STOCK_RESERVE: 'STOCK_RESERVE',
  STOCK_RELEASE: 'STOCK_RELEASE',
  RETURN_RESTOCK: 'RETURN_RESTOCK',
  ADJUSTMENT: 'ADJUSTMENT',
  TRANSFER: 'TRANSFER',
};

export const COURIER_PROVIDERS = {
  LCS: 'lcs',
  POSTEX: 'postex',
  MNP: 'mnp',
  TRAX: 'trax',
};

export const SAAS_PLANS = {
  STARTER: 'starter',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
};
