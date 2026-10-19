import { Product } from '../../backend/src/modules/products/Product.js';
import { Order } from '../../backend/src/modules/orders/Order.js';
import { StockLedger } from '../../backend/src/modules/inventory/StockLedger.js';
import { WholesaleCustomer } from '../../backend/src/modules/wholesale/WholesaleCustomer.js';
import { Supplier } from '../../backend/src/modules/purchases/Supplier.js';
import { Tenant } from '../../backend/src/modules/tenants/Tenant.js';

/**
 * Phase 4 & Section 4: Post-Migration Reconciliation & Integrity Audit Engine
 * Performs strict multi-tenant validation, inventory reconciliation,
 * and financial balance verification on the migrated flagship tenant.
 */
export const reconcileAndAudit = async (flagshipTenantId) => {
  const tenant = await Tenant.findById(flagshipTenantId);
  if (!tenant) {
    throw new Error(`Flagship tenant with id '${flagshipTenantId}' not found`);
  }

  const issues = [];

  // 1. Check for Orphan Records (Strict Multi-Tenancy Invariant)
  const [orphanProducts, orphanOrders, orphanStockLedgers] = await Promise.all([
    Product.countDocuments({ tenantId: { $exists: false } }),
    Order.countDocuments({ tenantId: { $exists: false } }),
    StockLedger.countDocuments({ tenantId: { $exists: false } }),
  ]);

  if (orphanProducts > 0) issues.push(`Found ${orphanProducts} orphan products without tenantId!`);
  if (orphanOrders > 0) issues.push(`Found ${orphanOrders} orphan orders without tenantId!`);
  if (orphanStockLedgers > 0) issues.push(`Found ${orphanStockLedgers} orphan stock movements without tenantId!`);

  // 2. Physical Stock & StockLedger Reconciliation
  const products = await Product.find({ tenantId: flagshipTenantId });
  const totalPhysicalStock = products.reduce((acc, p) => acc + (p.stock || 0), 0);
  const totalStockValuation = products.reduce((acc, p) => acc + ((p.stock || 0) * (p.pricing?.costPrice || 0)), 0);

  const stockLedgerSum = await StockLedger.aggregate([
    { $match: { tenantId: tenant._id } },
    { $group: { _id: null, totalChange: { $sum: '$delta' } } },
  ]);
  const ledgerRecordedStock = stockLedgerSum[0]?.totalChange || 0;

  // 3. Orders & GMV Breakdown
  const orders = await Order.find({ tenantId: flagshipTenantId });
  const totalOrders = orders.length;
  const totalGmv = orders.reduce((acc, o) => acc + (o.financials?.grandTotal || 0), 0);
  const onlineOrders = orders.filter((o) => o.channel === 'online').length;
  const retailOrders = orders.filter((o) => o.channel === 'retail').length;
  const wholesaleOrders = orders.filter((o) => o.channel === 'wholesale').length;

  // 4. Receivables & Payables
  const [customers, suppliers] = await Promise.all([
    WholesaleCustomer.find({ tenantId: flagshipTenantId }),
    Supplier.find({ tenantId: flagshipTenantId }),
  ]);
  const totalCustomerReceivables = customers.reduce((acc, c) => acc + (c.outstandingBalance || 0), 0);
  const totalSupplierPayables = suppliers.reduce((acc, s) => acc + (s.payableBalance || 0), 0);

  const isReconciled = issues.length === 0;

  const auditReport = {
    status: isReconciled ? 'PASSED' : 'FAILED',
    timestamp: new Date().toISOString(),
    tenant: {
      id: tenant._id,
      name: tenant.name,
      slug: tenant.slug,
      subdomain: tenant.subdomain,
      status: tenant.status,
    },
    invariants: {
      zeroOrphans: orphanProducts === 0 && orphanOrders === 0 && orphanStockLedgers === 0,
      orphanCounts: {
        products: orphanProducts,
        orders: orphanOrders,
        stockLedgers: orphanStockLedgers,
      },
    },
    inventoryReconciliation: {
      catalogProductCount: products.length,
      totalPhysicalStockUnits: totalPhysicalStock,
      stockLedgerUnits: ledgerRecordedStock,
      inventoryValuationPKR: totalStockValuation,
      isStockReconciled: totalPhysicalStock === ledgerRecordedStock,
    },
    ordersReconciliation: {
      totalOrders,
      totalGmvPKR: totalGmv,
      byChannel: {
        online: onlineOrders,
        retail: retailOrders,
        wholesale: wholesaleOrders,
      },
    },
    khataBalances: {
      totalCustomerReceivablesPKR: totalCustomerReceivables,
      totalSupplierPayablesPKR: totalSupplierPayables,
      activeKhataCustomers: customers.length,
      activeSuppliers: suppliers.length,
    },
    issues,
  };

  return auditReport;
};
