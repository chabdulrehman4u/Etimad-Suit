import { describe, it, expect, vi } from 'vitest';
import { requirePermission, requireRole } from '../../src/middleware/rbac.js';
import { ROLES, PERMISSIONS } from '../../src/modules/auth/roles.js';

describe('RBAC Middleware Guards Unit Suite', () => {
  it('1. requirePermission calls next() when role has the permission', () => {
    const req = {
      user: { _id: 'user1' },
      membership: {
        role: ROLES.SELLER_OWNER,
        customPermissions: [],
      },
    };
    const res = {};
    const next = vi.fn();

    const middleware = requirePermission(PERMISSIONS.CATALOG_WRITE);
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('2. requirePermission returns 403 when role lacks permission', () => {
    const req = {
      user: { _id: 'cashier1' },
      membership: {
        role: ROLES.CASHIER,
        customPermissions: [],
      },
    };
    let responseStatus = null;
    let responseBody = null;

    const res = {
      status: (code) => {
        responseStatus = code;
        return {
          json: (body) => {
            responseBody = body;
          },
        };
      },
    };
    const next = vi.fn();

    const middleware = requirePermission(PERMISSIONS.FINANCE_WRITE);
    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(responseStatus).toBe(403);
    expect(responseBody.error.code).toBe('PERMISSION_DENIED');
  });

  it('3. requirePermission grants access if platform superadmin', () => {
    const req = {
      user: { _id: 'admin1', isPlatformAdmin: true },
      membership: null,
    };
    const res = {};
    const next = vi.fn();

    const middleware = requirePermission(PERMISSIONS.PLATFORM_MANAGE);
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('4. requireRole allows matching role', () => {
    const req = {
      user: { _id: 'user1' },
      membership: { role: ROLES.ACCOUNTANT },
    };
    const res = {};
    const next = vi.fn();

    const middleware = requireRole(ROLES.ACCOUNTANT, ROLES.SELLER_OWNER);
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('5. requireRole denies non-matching role with 403 ROLE_DENIED', () => {
    const req = {
      user: { _id: 'user1' },
      membership: { role: ROLES.CASHIER },
    };
    let responseStatus = null;
    let responseBody = null;

    const res = {
      status: (code) => {
        responseStatus = code;
        return {
          json: (body) => {
            responseBody = body;
          },
        };
      },
    };
    const next = vi.fn();

    const middleware = requireRole(ROLES.SELLER_OWNER, ROLES.BUSINESS_MANAGER);
    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(responseStatus).toBe(403);
    expect(responseBody.error.code).toBe('ROLE_DENIED');
  });
});

