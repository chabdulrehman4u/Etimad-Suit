import { describe, it, expect, vi } from 'vitest';
import { resolveTenantContext, resolvePublicStorefrontTenant } from '../../src/middleware/tenant.js';
import { Tenant } from '../../src/modules/tenants/Tenant.js';
import { TenantMembership } from '../../src/modules/tenants/TenantMembership.js';
import mongoose from 'mongoose';

describe('Tenant Context Middleware Unit Suite', () => {
  it('1. Rejects unauthenticated request with 401 UNAUTHENTICATED', async () => {
    const req = { user: null };
    let status = null;
    let body = null;
    const res = {
      status: (code) => {
        status = code;
        return { json: (b) => { body = b; } };
      },
    };
    const next = vi.fn();

    await resolveTenantContext(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toBe(401);
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it('2. Rejects request when user does not have membership in target tenant', async () => {
    const fakeTenantId = new mongoose.Types.ObjectId();
    const req = {
      user: { _id: new mongoose.Types.ObjectId(), isPlatformAdmin: false },
      jwtClaims: { tenantId: fakeTenantId },
      headers: {},
    };

    // Mock TenantMembership.findOne to return null (no membership)
    vi.spyOn(TenantMembership, 'findOne').mockReturnValue({
      populate: vi.fn().mockResolvedValue(null),
    });

    let status = null;
    let body = null;
    const res = {
      status: (code) => {
        status = code;
        return { json: (b) => { body = b; } };
      },
    };
    const next = vi.fn();

    await resolveTenantContext(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toBe(403);
    expect(body.error.code).toBe('NO_TENANT_MEMBERSHIP');

    vi.restoreAllMocks();
  });

  it('3. Successfully attaches req.tenant, req.tenantId and req.scopeTenant when membership exists', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const mockTenant = {
      _id: tenantId,
      name: 'Apex Store',
      status: 'active',
    };

    const mockMembership = {
      _id: new mongoose.Types.ObjectId(),
      tenantId: mockTenant,
      role: 'SELLER_OWNER',
      status: 'active',
    };

    vi.spyOn(TenantMembership, 'findOne').mockReturnValue({
      populate: vi.fn().mockResolvedValue(mockMembership),
    });

    const req = {
      user: { _id: new mongoose.Types.ObjectId(), isPlatformAdmin: false },
      jwtClaims: { tenantId },
      headers: {},
    };
    const res = {};
    const next = vi.fn();

    await resolveTenantContext(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenant).toEqual(mockTenant);
    expect(req.tenantId).toEqual(tenantId);
    expect(req.membership).toEqual(mockMembership);

    // Verify scopeTenant helper automatically injects tenantId
    const scoped = req.scopeTenant({ category: 'Electronics' });
    expect(scoped).toEqual({
      category: 'Electronics',
      tenantId,
    });

    vi.restoreAllMocks();
  });

  it('4. Rejects request if target tenant is suspended', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const suspendedTenant = {
      _id: tenantId,
      name: 'Bad Actor Store',
      status: 'suspended',
    };

    const mockMembership = {
      tenantId: suspendedTenant,
      role: 'SELLER_OWNER',
      status: 'active',
    };

    vi.spyOn(TenantMembership, 'findOne').mockReturnValue({
      populate: vi.fn().mockResolvedValue(mockMembership),
    });

    const req = {
      user: { _id: new mongoose.Types.ObjectId(), isPlatformAdmin: false },
      jwtClaims: { tenantId },
      headers: {},
    };
    let status = null;
    let body = null;
    const res = {
      status: (code) => {
        status = code;
        return { json: (b) => { body = b; } };
      },
    };
    const next = vi.fn();

    await resolveTenantContext(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toBe(403);
    expect(body.error.code).toBe('TENANT_INACTIVE');

    vi.restoreAllMocks();
  });

  it('5. Allows Platform Admin access to tenant with audit flag', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const mockTenant = {
      _id: tenantId,
      name: 'Audited Store',
      status: 'active',
    };

    vi.spyOn(Tenant, 'findById').mockResolvedValue(mockTenant);

    const req = {
      user: { _id: new mongoose.Types.ObjectId(), isPlatformAdmin: true },
      jwtClaims: {},
      headers: { 'x-tenant-id': String(tenantId) },
    };
    const res = {};
    const next = vi.fn();

    await resolveTenantContext(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenant).toEqual(mockTenant);
    expect(req.membership.isPlatformImpersonation).toBe(true);
    expect(req.membership.role).toBe('SUPER_ADMIN');

    vi.restoreAllMocks();
  });
});

