import jwt from 'jsonwebtoken';
import { User } from './User.js';
import { Tenant } from '../tenants/Tenant.js';
import { TenantMembership } from '../tenants/TenantMembership.js';
import { ROLES } from './roles.js';
import { config } from '../../config/index.js';

// Helper to generate JWT token
export const generateToken = ({ userId, tenantId, role, isPlatformAdmin }) => {
  return jwt.sign(
    {
      userId,
      tenantId: tenantId ? String(tenantId) : null,
      role: role || null,
      isPlatformAdmin: Boolean(isPlatformAdmin),
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
};

// Set HTTP-only session cookie
export const setAuthCookie = (res, token) => {
  const isProd = config.env === 'production';
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
};

/**
 * 1. Self-Service Tenant & Merchant Owner Registration
 */
export const registerTenant = async (req, res) => {
  try {
    const { tenantName, slug, subdomain, ownerName, email, password, phone } = req.body || {};

    if (!tenantName || !ownerName || !email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Tenant name, owner name, email, and password are required.' },
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 6 characters.' },
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanSlug = String(slug || tenantName).trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    const cleanSubdomain = String(subdomain || cleanSlug).trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

    // Check duplicate email
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_IN_USE', message: 'An account with this email address already exists.' },
      });
    }

    // Check duplicate slug/subdomain
    const existingTenant = await Tenant.findOne({
      $or: [{ slug: cleanSlug }, { subdomain: cleanSubdomain }],
    });

    if (existingTenant) {
      return res.status(409).json({
        success: false,
        error: { code: 'SLUG_TAKEN', message: 'This store slug or subdomain is already taken. Please choose another.' },
      });
    }

    // 1. Create User
    const user = new User({
      name: String(ownerName).trim(),
      email: cleanEmail,
      password,
      phone: phone ? String(phone).trim() : undefined,
    });
    await user.save();

    // 2. Create Tenant
    const tenant = new Tenant({
      name: String(tenantName).trim(),
      slug: cleanSlug,
      subdomain: cleanSubdomain,
      ownerId: user._id,
      status: 'active',
      settings: {
        currency: 'PKR',
        currencySymbol: 'Rs.',
        timezone: 'Asia/Karachi',
        contactPhone: user.phone || '',
        contactEmail: user.email,
      },
    });
    await tenant.save();

    // 3. Create Tenant Membership (Owner)
    const membership = new TenantMembership({
      tenantId: tenant._id,
      userId: user._id,
      role: ROLES.SELLER_OWNER,
      status: 'active',
    });
    await membership.save();

    // Generate Auth Token
    const token = generateToken({
      userId: user._id,
      tenantId: tenant._id,
      role: ROLES.SELLER_OWNER,
      isPlatformAdmin: false,
    });

    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          isPlatformAdmin: user.isPlatformAdmin,
        },
        tenant: {
          _id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          subdomain: tenant.subdomain,
          status: tenant.status,
          settings: tenant.settings,
        },
        membership: {
          role: membership.role,
        },
      },
    });
  } catch (err) {
    console.error('Tenant Registration Error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'REGISTRATION_FAILED', message: err.message || 'Failed to register tenant.' },
    });
  }
};

/**
 * 2. Unified User & Staff Login
 */
export const login = async (req, res) => {
  try {
    const { email, password, targetTenantId } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Email and password are required.' },
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_FAILED', message: 'Invalid email or password.' },
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_FAILED', message: 'Invalid email or password.' },
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_SUSPENDED', message: 'This account has been suspended.' },
      });
    }

    // Find all active memberships
    const memberships = await TenantMembership.find({
      userId: user._id,
      status: 'active',
    }).populate('tenantId');

    // If regular user without any tenant memberships and not a superadmin
    if (memberships.length === 0 && !user.isPlatformAdmin) {
      return res.status(403).json({
        success: false,
        error: { code: 'NO_ACTIVE_TENANTS', message: 'You do not have access to any active merchant businesses.' },
      });
    }

    // Determine active tenant:
    // If targetTenantId specified and user belongs to it, use it. Otherwise, default to first membership.
    let activeMembership = null;
    if (targetTenantId) {
      activeMembership = memberships.find((m) => String(m.tenantId?._id) === String(targetTenantId));
    }
    if (!activeMembership && memberships.length > 0) {
      activeMembership = memberships[0];
    }

    const activeTenant = activeMembership ? activeMembership.tenantId : null;
    const activeRole = activeMembership ? activeMembership.role : (user.isPlatformAdmin ? ROLES.SUPER_ADMIN : null);

    const token = generateToken({
      userId: user._id,
      tenantId: activeTenant?._id,
      role: activeRole,
      isPlatformAdmin: user.isPlatformAdmin,
    });

    setAuthCookie(res, token);
    user.lastLoginAt = new Date();
    await user.save();

    return res.json({
      success: true,
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          isPlatformAdmin: user.isPlatformAdmin,
        },
        activeTenant: activeTenant
          ? {
              _id: activeTenant._id,
              name: activeTenant.name,
              slug: activeTenant.slug,
              subdomain: activeTenant.subdomain,
              status: activeTenant.status,
              settings: activeTenant.settings,
            }
          : null,
        activeRole,
        availableTenants: memberships.map((m) => ({
          tenantId: m.tenantId?._id,
          name: m.tenantId?.name,
          slug: m.tenantId?.slug,
          subdomain: m.tenantId?.subdomain,
          role: m.role,
        })),
      },
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'LOGIN_FAILED', message: err.message || 'Login failed.' },
    });
  }
};

/**
 * 3. Logout (Clears HTTP-Only Cookie)
 */
export const logout = (req, res) => {
  res.clearCookie(config.cookieName, { path: '/' });
  return res.json({ success: true, message: 'Successfully logged out.' });
};

/**
 * 4. Get Current Identity Profile
 */
export const getMe = async (req, res) => {
  try {
    const memberships = await TenantMembership.find({
      userId: req.user._id,
      status: 'active',
    }).populate('tenantId');

    return res.json({
      success: true,
      data: {
        user: req.user,
        activeTenant: req.tenant || null,
        activeMembership: req.membership || null,
        availableTenants: memberships.map((m) => ({
          tenantId: m.tenantId?._id,
          name: m.tenantId?.name,
          slug: m.tenantId?.slug,
          subdomain: m.tenantId?.subdomain,
          role: m.role,
        })),
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'PROFILE_ERROR', message: err.message },
    });
  }
};

