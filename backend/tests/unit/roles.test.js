import { describe, it, expect } from 'vitest';
import { ROLES, PERMISSIONS, ROLE_PERMISSIONS, hasPermission } from '../../src/modules/auth/roles.js';

describe('RBAC Roles & Permissions Matrix Specification', () => {
  it('1. SUPER_ADMIN possesses every platform and tenant permission', () => {
    const allPerms = Object.values(PERMISSIONS);
    allPerms.forEach((perm) => {
      expect(hasPermission(ROLES.SUPER_ADMIN, perm)).toBe(true);
    });
  });

  it('2. SELLER_OWNER has billing, settings, staff, and complete store operations', () => {
    expect(hasPermission(ROLES.SELLER_OWNER, PERMISSIONS.TENANT_BILLING)).toBe(true);
    expect(hasPermission(ROLES.SELLER_OWNER, PERMISSIONS.TENANT_SETTINGS)).toBe(true);
    expect(hasPermission(ROLES.SELLER_OWNER, PERMISSIONS.STAFF_MANAGE)).toBe(true);
    expect(hasPermission(ROLES.SELLER_OWNER, PERMISSIONS.CATALOG_WRITE)).toBe(true);
    expect(hasPermission(ROLES.SELLER_OWNER, PERMISSIONS.FINANCE_WRITE)).toBe(true);
    // Platform management is strictly restricted to platform superadmin
    expect(hasPermission(ROLES.SELLER_OWNER, PERMISSIONS.PLATFORM_MANAGE)).toBe(false);
  });

  it('3. BUSINESS_MANAGER cannot access subscription billing or platform manage', () => {
    expect(hasPermission(ROLES.BUSINESS_MANAGER, PERMISSIONS.TENANT_SETTINGS)).toBe(true);
    expect(hasPermission(ROLES.BUSINESS_MANAGER, PERMISSIONS.ORDERS_READ)).toBe(true);
    expect(hasPermission(ROLES.BUSINESS_MANAGER, PERMISSIONS.CATALOG_WRITE)).toBe(true);
    expect(hasPermission(ROLES.BUSINESS_MANAGER, PERMISSIONS.TENANT_BILLING)).toBe(false);
    expect(hasPermission(ROLES.BUSINESS_MANAGER, PERMISSIONS.PLATFORM_MANAGE)).toBe(false);
  });

  it('4. CASHIER is strictly limited to POS and catalog reading', () => {
    expect(hasPermission(ROLES.CASHIER, PERMISSIONS.ORDERS_CREATE_POS)).toBe(true);
    expect(hasPermission(ROLES.CASHIER, PERMISSIONS.CATALOG_READ)).toBe(true);
    expect(hasPermission(ROLES.CASHIER, PERMISSIONS.INVENTORY_READ)).toBe(true);

    // Forbidden operations
    expect(hasPermission(ROLES.CASHIER, PERMISSIONS.CATALOG_WRITE)).toBe(false);
    expect(hasPermission(ROLES.CASHIER, PERMISSIONS.TENANT_SETTINGS)).toBe(false);
    expect(hasPermission(ROLES.CASHIER, PERMISSIONS.STAFF_MANAGE)).toBe(false);
    expect(hasPermission(ROLES.CASHIER, PERMISSIONS.FINANCE_READ)).toBe(false);
    expect(hasPermission(ROLES.CASHIER, PERMISSIONS.FINANCE_WRITE)).toBe(false);
    expect(hasPermission(ROLES.CASHIER, PERMISSIONS.PURCHASES_MANAGE)).toBe(false);
  });

  it('5. INVENTORY_MANAGER can adjust stock and receive purchases, but cannot alter finance directly', () => {
    expect(hasPermission(ROLES.INVENTORY_MANAGER, PERMISSIONS.INVENTORY_ADJUST)).toBe(true);
    expect(hasPermission(ROLES.INVENTORY_MANAGER, PERMISSIONS.PURCHASES_MANAGE)).toBe(true);
    expect(hasPermission(ROLES.INVENTORY_MANAGER, PERMISSIONS.CATALOG_WRITE)).toBe(true);
    expect(hasPermission(ROLES.INVENTORY_MANAGER, PERMISSIONS.FINANCE_WRITE)).toBe(false);
    expect(hasPermission(ROLES.INVENTORY_MANAGER, PERMISSIONS.TENANT_SETTINGS)).toBe(false);
  });

  it('6. ACCOUNTANT has read/write access to financial ledgers, but cannot configure store themes', () => {
    expect(hasPermission(ROLES.ACCOUNTANT, PERMISSIONS.FINANCE_READ)).toBe(true);
    expect(hasPermission(ROLES.ACCOUNTANT, PERMISSIONS.FINANCE_WRITE)).toBe(true);
    expect(hasPermission(ROLES.ACCOUNTANT, PERMISSIONS.PURCHASES_MANAGE)).toBe(true);
    expect(hasPermission(ROLES.ACCOUNTANT, PERMISSIONS.TENANT_SETTINGS)).toBe(false);
    expect(hasPermission(ROLES.ACCOUNTANT, PERMISSIONS.CATALOG_WRITE)).toBe(false);
  });

  it('7. DISPATCH_STAFF can book shipments and inspect returns', () => {
    expect(hasPermission(ROLES.DISPATCH_STAFF, PERMISSIONS.SHIPPING_BOOK)).toBe(true);
    expect(hasPermission(ROLES.DISPATCH_STAFF, PERMISSIONS.RETURNS_INSPECT)).toBe(true);
    expect(hasPermission(ROLES.DISPATCH_STAFF, PERMISSIONS.FINANCE_READ)).toBe(false);
  });

  it('8. Supports custom permission overrides per membership', () => {
    // A cashier with an explicit custom permission override for INVENTORY_ADJUST
    const customPerms = [PERMISSIONS.INVENTORY_ADJUST];
    expect(hasPermission(ROLES.CASHIER, PERMISSIONS.INVENTORY_ADJUST, customPerms)).toBe(true);
    expect(hasPermission(ROLES.CASHIER, PERMISSIONS.FINANCE_WRITE, customPerms)).toBe(false);
  });

  it('9. CUSTOMER has zero staff permissions', () => {
    const customerPerms = ROLE_PERMISSIONS[ROLES.CUSTOMER];
    expect(customerPerms).toEqual([]);
    expect(hasPermission(ROLES.CUSTOMER, PERMISSIONS.CATALOG_READ)).toBe(false);
  });
});

