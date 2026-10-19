import { User } from '../../backend/src/modules/auth/User.js';
import { TenantMembership } from '../../backend/src/modules/tenants/TenantMembership.js';
import { ROLES } from '../../backend/src/modules/auth/roles.js';

/**
 * Phase C: User & Staff Migration
 * Maps legacy Ecommerce and IMS users into unified User collection
 * and tenant-scoped TenantMembership records.
 */
export const migrateUsersAndStaff = async ({
  legacyEcommerceUsers = [],
  legacyImsUsers = [],
  flagshipTenantId,
}) => {
  let migratedUsersCount = 0;
  let migratedMembershipsCount = 0;
  const userMap = new Map(); // email -> User document

  const allLegacyUsers = [
    ...legacyEcommerceUsers.map((u) => ({ ...u, source: 'ecommerce' })),
    ...legacyImsUsers.map((u) => ({ ...u, source: 'ims' })),
  ];

  for (const rawUser of allLegacyUsers) {
    const email = String(rawUser.email || '').toLowerCase().trim();
    if (!email) continue;

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        name: rawUser.name || rawUser.username || 'Migrated User',
        email,
        password: rawUser.password || '$2a$10$migratedDefaultPlaceholderHash2026',
        phone: rawUser.phone || rawUser.mobile || undefined,
        isPlatformAdmin: rawUser.role === 'superadmin' || rawUser.isSuperAdmin === true,
        status: rawUser.status === 'blocked' || rawUser.isActive === false ? 'suspended' : 'active',
      });
      await user.save();
      migratedUsersCount++;
    }
    userMap.set(email, user);

    // Map role to TenantMembership
    let targetRole = ROLES.CUSTOMER;
    const rawRole = String(rawUser.role || '').toLowerCase();

    if (rawRole === 'superadmin' || rawRole === 'owner') {
      targetRole = ROLES.SELLER_OWNER;
    } else if (rawRole === 'admin' || rawRole === 'manager') {
      targetRole = ROLES.BUSINESS_MANAGER;
    } else if (rawRole === 'seller' || rawRole === 'cashier') {
      targetRole = ROLES.CASHIER;
    } else if (rawRole === 'dispatch' || rawRole === 'warehouse') {
      targetRole = ROLES.DISPATCH_STAFF;
    } else if (rawRole === 'accountant') {
      targetRole = ROLES.ACCOUNTANT;
    }

    // Only create TenantMembership if user is staff (not pure external customer)
    if (targetRole !== ROLES.CUSTOMER) {
      const existingMembership = await TenantMembership.findOne({
        tenantId: flagshipTenantId,
        userId: user._id,
      });

      if (!existingMembership) {
        const membership = new TenantMembership({
          tenantId: flagshipTenantId,
          userId: user._id,
          role: targetRole,
          status: 'active',
        });
        await membership.save();
        migratedMembershipsCount++;
      }
    }
  }

  return {
    migratedUsersCount,
    migratedMembershipsCount,
    userMap,
  };
};
