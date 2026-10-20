import { migrateFlagshipTenant } from './migrateFlagshipTenant.js';
import { migrateUsersAndStaff } from './migrateUsersAndStaff.js';
import { migrateTaxonomiesAndProducts } from './migrateTaxonomiesAndProducts.js';
import { migrateCustomersAndSuppliers } from './migrateCustomersAndSuppliers.js';
import { migrateOrdersAndBills } from './migrateOrdersAndBills.js';
import { reconcileAndAudit } from './reconcileAndAudit.js';

/**
 * Master Migration Orchestrator for Etimad Suit SaaS
 * Coordinates zero-downtime staged migration from legacy systems into staging DB.
 */
export const runMigration = async ({
  legacyData = {},
  options = { verbose: false },
} = {}) => {
  const startTime = Date.now();
  if (options.verbose) console.log('🚀 [Migration Pipeline] Initializing Etimad Suit SaaS Staged Migration...');

  // Phase B: Provision Flagship Tenant
  if (options.verbose) console.log('📦 [Phase B] Provisioning Flagship Tenant (etimadmart)...');
  const { tenant, plan, owner } = await migrateFlagshipTenant({
    ownerUserId: legacyData.ownerUserId,
  });

  const flagshipTenantId = tenant._id;

  // Phase C: Migrate Users & Staff
  if (options.verbose) console.log('👥 [Phase C] Migrating Users & Staff Memberships...');
  const userResults = await migrateUsersAndStaff({
    legacyEcommerceUsers: legacyData.ecommerceUsers || [],
    legacyImsUsers: legacyData.imsUsers || [],
    flagshipTenantId,
  });

  // Phase E: Taxonomies & Products Reconciliation
  if (options.verbose) console.log('🛍️ [Phase E] Reconciling Products, Images, & Physical Stock...');
  const productResults = await migrateTaxonomiesAndProducts({
    legacyEcommerceProducts: legacyData.ecommerceProducts || [],
    legacyImsProducts: legacyData.imsProducts || [],
    flagshipTenantId,
  });

  // Phase F: Customers & Suppliers Khata Migration
  if (options.verbose) console.log('📒 [Phase F] Migrating Customers Khata & Suppliers Payables...');
  const khataResults = await migrateCustomersAndSuppliers({
    legacyCustomers: legacyData.customers || [],
    legacySuppliers: legacyData.suppliers || [],
    flagshipTenantId,
  });

  // Phase G: Historical Orders & Bills Unification
  if (options.verbose) console.log('🛒 [Phase G] Converting Orders, POS Bills & Wholesale Dispatches...');
  const orderResults = await migrateOrdersAndBills({
    legacyEcommerceOrders: legacyData.ecommerceOrders || [],
    legacyImsBills: legacyData.imsBills || [],
    legacyWholesaleDispatches: legacyData.wholesaleDispatches || [],
    flagshipTenantId,
  });

  // Section 4: Post-Migration Reconciliation & Audit
  if (options.verbose) console.log('🔍 [Audit] Running Automated Reconciliation Checks...');
  const auditReport = await reconcileAndAudit(flagshipTenantId);

  const durationMs = Date.now() - startTime;
  if (options.verbose) console.log(`✅ [Migration Complete] Finished in ${durationMs}ms. Status: ${auditReport.status}`);

  return {
    success: auditReport.status === 'PASSED',
    durationMs,
    flagshipTenant: {
      id: tenant._id,
      name: tenant.name,
      slug: tenant.slug,
      subdomain: tenant.subdomain,
      plan: plan.name,
    },
    metrics: {
      users: userResults.migratedUsersCount,
      memberships: userResults.migratedMembershipsCount,
      products: productResults.totalProducts,
      matchedProducts: productResults.matchedCount,
      physicalStockUnits: productResults.totalStockUnits,
      stockValuationPKR: productResults.totalStockValuation,
      customers: khataResults.migratedCustomers,
      suppliers: khataResults.migratedSuppliers,
      orders: orderResults.totalOrdersMigrated,
      migratedGmvPKR: orderResults.totalMigratedGmv,
    },
    auditReport,
  };
};

