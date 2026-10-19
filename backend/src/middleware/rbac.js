import { hasPermission, ROLES } from '../modules/auth/roles.js';

/**
 * Require one or more permissions
 */
export const requirePermission = (...requiredPermissions) => {
  return (req, res, next) => {
    // Platform superadmins have full permission
    if (req.user?.isPlatformAdmin || req.membership?.role === ROLES.SUPER_ADMIN) {
      return next();
    }

    if (!req.membership) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Tenant membership context required for permission verification.',
        },
      });
    }

    const userRole = req.membership.role;
    const customPerms = req.membership.customPermissions || [];

    const hasAll = requiredPermissions.every((perm) =>
      hasPermission(userRole, perm, customPerms)
    );

    if (!hasAll) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: `Insufficient permissions. Required: [${requiredPermissions.join(', ')}]`,
        },
      });
    }

    next();
  };
};

/**
 * Require one of the specified roles directly
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (req.user?.isPlatformAdmin || req.membership?.role === ROLES.SUPER_ADMIN) {
      return next();
    }

    if (!req.membership || !allowedRoles.includes(req.membership.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ROLE_DENIED',
          message: `Access denied. Role must be one of: [${allowedRoles.join(', ')}]`,
        },
      });
    }

    next();
  };
};

