import { WholesaleCustomer } from '../../backend/src/modules/wholesale/WholesaleCustomer.js';
import { Supplier } from '../../backend/src/modules/purchases/Supplier.js';

/**
 * Phase F: Customers & Suppliers Khata Migration
 * Ingests and reconciles B2B/Wholesale customers and procurement suppliers
 * into tenant-scoped entities, preserving opening khata balances and credit limits.
 */
export const migrateCustomersAndSuppliers = async ({
  legacyCustomers = [],
  legacySuppliers = [],
  flagshipTenantId,
}) => {
  let migratedCustomers = 0;
  let migratedSuppliers = 0;
  const customerMap = new Map();
  const supplierMap = new Map();

  // 1. Ingest Wholesale / Khata Customers
  for (const rawCust of legacyCustomers) {
    const phone = String(rawCust.phone || rawCust.mobile || '').trim();
    if (!phone) continue;

    let customer = await WholesaleCustomer.findOne({
      tenantId: flagshipTenantId,
      phone,
    });

    if (!customer) {
      customer = new WholesaleCustomer({
        tenantId: flagshipTenantId,
        name: rawCust.name || 'Migrated Khata Customer',
        companyName: rawCust.companyName || rawCust.company || '',
        phone,
        email: rawCust.email ? String(rawCust.email).toLowerCase().trim() : undefined,
        address: rawCust.address || '',
        city: rawCust.city || 'Rawalpindi',
        creditLimit: Math.max(0, Number(rawCust.creditLimit) || 0),
        creditTermsDays: Number(rawCust.creditTermsDays) || 30,
        outstandingBalance: Math.max(0, Number(rawCust.outstandingBalance || rawCust.khataDebt) || 0),
        priceTier: rawCust.priceTier || 'standard',
        notes: 'Migrated from legacy customer khata',
      });
      await customer.save();
      migratedCustomers++;
    } else {
      // Reconcile outstanding balance if higher
      if (rawCust.outstandingBalance) {
        customer.outstandingBalance = Math.max(0, Number(rawCust.outstandingBalance));
        await customer.save();
      }
    }

    customerMap.set(phone, customer);
  }

  // 2. Ingest Suppliers
  for (const rawSupp of legacySuppliers) {
    const phone = String(rawSupp.phone || rawSupp.mobile || '').trim();
    const name = String(rawSupp.name || rawSupp.supplierName || '').trim();
    if (!name || !phone) continue;

    let supplier = await Supplier.findOne({
      tenantId: flagshipTenantId,
      $or: [{ phone }, { name }],
    });

    if (!supplier) {
      supplier = new Supplier({
        tenantId: flagshipTenantId,
        name,
        company: rawSupp.company || '',
        phone,
        email: rawSupp.email ? String(rawSupp.email).toLowerCase().trim() : '',
        address: rawSupp.address || '',
        payableBalance: Math.max(0, Number(rawSupp.payableBalance || rawSupp.balanceOwed) || 0),
        notes: 'Migrated from legacy supplier ledger',
      });
      await supplier.save();
      migratedSuppliers++;
    }

    supplierMap.set(supplier._id.toString(), supplier);
  }

  return {
    migratedCustomers,
    migratedSuppliers,
    customerMap,
    supplierMap,
  };
};

