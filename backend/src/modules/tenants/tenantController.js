import mongoose from 'mongoose';
import { Tenant } from './Tenant.js';
import { TenantMembership } from './TenantMembership.js';
import { User } from '../auth/User.js';
import { ROLES } from '../auth/roles.js';

/**
 * 1. Get Current Tenant Profile
 */
export const getTenantProfile = async (req, res) => {
  return res.json({
    success: true,
    data: req.tenant,
  });
};

/**
 * 2. Update Tenant Settings & Branding
 */
export const updateTenantProfile = async (req, res) => {
  try {
    const { name, settings } = req.body || {};

    if (name) req.tenant.name = String(name).trim();
    if (settings && typeof settings === 'object') {
      req.tenant.settings = {
        ...req.tenant.settings,
        ...settings,
      };
    }

    await req.tenant.save();

    return res.json({
      success: true,
      data: req.tenant,
      message: 'Tenant profile updated successfully.',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: err.message },
    });
  }
};

/**
 * 3. List Tenant Staff Members
 */
export const listMembers = async (req, res) => {
  try {
    const members = await TenantMembership.find({ tenantId: req.tenantId })
      .populate('userId', 'name email phone status lastLoginAt')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: members.map((m) => ({
        membershipId: m._id,
        user: m.userId,
        role: m.role,
        status: m.status,
        customPermissions: m.customPermissions,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'LIST_FAILED', message: err.message },
    });
  }
};

/**
 * 4. Invite / Add Staff Member to Tenant
 */
export const inviteMember = async (req, res) => {
  try {
    const { name, email, password, role, phone, customPermissions } = req.body || {};

    if (!email || !role) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Email and role are required.' },
      });
    }

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ROLE', message: `Role must be one of: ${Object.values(ROLES).join(', ')}` },
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Find or create User
    let user = await User.findOne({ email: cleanEmail });
    if (!user) {
      if (!name || !password) {
        return res.status(400).json({
          success: false,
          error: { code: 'NEW_USER_REQUIRED', message: 'Name and initial password required for new user invitation.' },
        });
      }

      user = new User({
        name: String(name).trim(),
        email: cleanEmail,
        password: String(password),
        phone: phone ? String(phone).trim() : undefined,
      });
      await user.save();
    }

    // Check if membership already exists for this tenant
    const existingMembership = await TenantMembership.findOne({
      tenantId: req.tenantId,
      userId: user._id,
    });

    if (existingMembership) {
      return res.status(409).json({
        success: false,
        error: { code: 'ALREADY_MEMBER', message: 'User is already a staff member in this tenant.' },
      });
    }

    const membership = new TenantMembership({
      tenantId: req.tenantId,
      userId: user._id,
      role,
      customPermissions: Array.isArray(customPermissions) ? customPermissions : [],
      status: 'active',
      invitedBy: req.user._id,
    });
    await membership.save();

    return res.status(201).json({
      success: true,
      data: {
        membershipId: membership._id,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
        },
        role: membership.role,
        status: membership.status,
      },
      message: 'Staff member added successfully.',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'INVITE_FAILED', message: err.message },
    });
  }
};

/**
 * 5. Update Staff Role / Status
 */
export const updateMemberRole = async (req, res) => {
  try {
    const { membershipId } = req.params;
    const { role, status, customPermissions } = req.body || {};

    const membership = await TenantMembership.findOne({
      _id: membershipId,
      tenantId: req.tenantId, // Strict tenant isolation guard
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Staff membership not found in this tenant.' },
      });
    }

    // Prevent removing the last SELLER_OWNER
    if (membership.role === ROLES.SELLER_OWNER && role && role !== ROLES.SELLER_OWNER) {
      const ownerCount = await TenantMembership.countDocuments({
        tenantId: req.tenantId,
        role: ROLES.SELLER_OWNER,
        status: 'active',
      });
      if (ownerCount <= 1) {
        return res.status(400).json({
          success: false,
          error: { code: 'CANNOT_DEMOTE_LAST_OWNER', message: 'A business must have at least one active owner.' },
        });
      }
    }

    if (role && Object.values(ROLES).includes(role)) membership.role = role;
    if (status && ['active', 'invited', 'suspended'].includes(status)) membership.status = status;
    if (Array.isArray(customPermissions)) membership.customPermissions = customPermissions;

    await membership.save();

    return res.json({
      success: true,
      data: membership,
      message: 'Staff membership updated successfully.',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'UPDATE_MEMBER_FAILED', message: err.message },
    });
  }
};

/**
 * 6. Remove Member from Tenant
 */
export const removeMember = async (req, res) => {
  try {
    const { membershipId } = req.params;

    const membership = await TenantMembership.findOne({
      _id: membershipId,
      tenantId: req.tenantId, // Strict tenant isolation guard
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Staff membership not found.' },
      });
    }

    if (membership.role === ROLES.SELLER_OWNER) {
      const ownerCount = await TenantMembership.countDocuments({
        tenantId: req.tenantId,
        role: ROLES.SELLER_OWNER,
        status: 'active',
      });
      if (ownerCount <= 1) {
        return res.status(400).json({
          success: false,
          error: { code: 'CANNOT_DELETE_LAST_OWNER', message: 'Cannot delete the only owner of this business.' },
        });
      }
    }

    await membership.deleteOne();

    return res.json({
      success: true,
      message: 'Staff member removed from business.',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'REMOVE_FAILED', message: err.message },
    });
  }
};

/**
 * 7. Custom Domain Configuration & Verification
 */
export const addCustomDomain = async (req, res) => {
  try {
    const { domain } = req.body || {};
    if (!domain) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_DOMAIN', message: 'Domain name is required.' },
      });
    }

    const cleanDomain = String(domain).toLowerCase().trim();

    // Check conflict across all tenants
    const existing = await Tenant.findOne({ 'customDomains.domain': cleanDomain });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'DOMAIN_IN_USE', message: 'This domain is already connected to an existing store.' },
      });
    }

    const verificationToken = `etimad-verify-${Math.random().toString(36).slice(2, 10)}`;
    req.tenant.customDomains.push({
      domain: cleanDomain,
      isVerified: false,
      verificationToken,
      isPrimary: req.tenant.customDomains.length === 0,
    });

    await req.tenant.save();

    return res.status(201).json({
      success: true,
      data: req.tenant.customDomains,
      instructions: {
        type: 'TXT',
        host: '@',
        value: verificationToken,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'DOMAIN_ADD_FAILED', message: err.message },
    });
  }
};

