# Etimad Suit — Multi-Tenant SaaS Platform

Etimad Suit is an enterprise-grade, multi-tenant SaaS application that unifies omnichannel e-commerce, retail point-of-sale (POS), wholesale distribution, inventory management, logistics adapters, and financial accounting into **ONE authoritative backend and single source of business truth**.

---

## 🎯 Architecture Pillars

1. **One Authoritative Backend**: All sales channels (`online`, `retail`, `wholesale`) feed into one canonical order pipeline and one authoritative stock ledger.
2. **Absolute Tenant Isolation**: Every seller is an independent business entity. Every data record is tenant-scoped with backend authorization enforcement and tenant-scoped compound indexes.
3. **Inventory Integrity & Atomic Concurrency**: No overselling. Stock mutations use conditional atomic operations with audit history tracking in `StockLedger`.
4. **Server-Authoritative Pricing**: Totals, volume pricing, wholesale tiers, coupons, shipping, and taxes are strictly calculated and validated on the backend.
5. **Pluggable Integration Architecture**: Courier (LCS, PostEx, M&P, TCS), payment, and communication providers are integrated via abstract provider adapters, storing encrypted credentials per tenant.
6. **Double-Entry Financial Accounting**: Real-time business valuation, cost-of-goods-sold (COGS) tracking, accounts payable, accounts receivable, and cash/bank reconciliation.

---

## 📁 Repository Structure

```text
Etimad-Suit/
├── apps/
│   ├── seller-dashboard/    # React 18 / Vite seller operations and management console
│   ├── storefront/          # High-performance multi-tenant tenant-branded storefront
│   └── platform-admin/      # SaaS super-admin console for tenant & subscription billing
├── backend/
│   ├── src/
│   │   ├── modules/         # Clean service-boundary modular monolith
│   │   │   ├── auth/        # Multi-tenant authentication, JWT, RBAC
│   │   │   ├── tenants/     # Tenant provisioning, custom domains, settings
│   │   │   ├── subscriptions/# Plans, entitlements, quotas, usage tracking
│   │   │   ├── products/    # Unified product catalog, variants, categories
│   │   │   ├── inventory/   # Authoritative stock ledger, adjustments, transfers
│   │   │   ├── orders/      # Canonical orders across online, POS, and wholesale
│   │   │   ├── pos/         # Retail point-of-sale rapid checkout and shift logs
│   │   │   ├── wholesale/   # B2B pricing tiers, customer khata, quotations
│   │   │   ├── purchases/   # Purchase batches, landed cost, receiving
│   │   │   ├── finance/     # Double-entry ledger, balance sheet, valuation
│   │   │   ├── shipping/    # Shipping parcels, courier dispatch, returns
│   │   │   ├── integrations/# Provider adapter framework (LCS, PostEx, M&P)
│   │   │   └── reports/     # Real-time multi-dimensional business reports
│   │   ├── middleware/      # Tenant context, auth guards, rate-limiting
│   │   ├── services/        # Cross-cutting orchestration services
│   │   ├── database/        # Mongoose connection and transaction utilities
│   │   └── config/          # Environment configuration and validation
│   └── tests/               # Automated unit, integration, and tenant-isolation tests
├── packages/
│   ├── shared-types/        # Canonical TypeScript / JSDoc shared domain models
│   ├── shared-validation/   # Universal schema validation (Zod)
│   └── ui/                  # Shared component system
├── docs/                    # Architectural blueprints and engineering guides
├── scripts/                 # Staged data migration and verification tools
├── .env.example             # Documented environment template with placeholders
├── .gitignore
└── package.json
```

---

## 📚 Core Architecture Documents (Phase 1 Deliverables)

Detailed architectural blueprints are maintained in the [`docs/`](file:///c:/Users/ETIMAD%20MART/Etimad-Suit/docs) directory:

1. [**ETIMAD_SUIT_ARCHITECTURE.md**](file:///c:/Users/ETIMAD%20MART/Etimad-Suit/docs/ETIMAD_SUIT_ARCHITECTURE.md)  
   Complete system architecture, multi-tenant scoping, modular monolith service boundaries, canonical order state machine, authoritative inventory ledger, and adapter framework.
2. [**EXISTING_FEATURE_MAPPING.md**](file:///c:/Users/ETIMAD%20MART/Etimad-Suit/docs/EXISTING_FEATURE_MAPPING.md)  
   Line-by-line audit of both source repositories (`Etimad-Mart-Ecommerce-Solution-2` and `Etimad-Mart-IMS`), with explicit classification (`REUSE`, `REFACTOR`, `REPLACE`, `RETIRE`).
3. [**DATABASE_AND_MIGRATION_PLAN.md**](file:///c:/Users/ETIMAD%20MART/Etimad-Suit/docs/DATABASE_AND_MIGRATION_PLAN.md)  
   Schema resolution, unified domain models, tenant-scoped indexes, zero-data-loss staged migration plan, rollback strategies, and reconciliation queries.
4. [**API_AND_PERMISSION_MATRIX.md**](file:///c:/Users/ETIMAD%20MART/Etimad-Suit/docs/API_AND_PERMISSION_MATRIX.md)  
   Complete REST API endpoints catalog, RBAC matrix across 10 distinct user roles, and tenant authorization enforcement specifications.
5. [**IMPLEMENTATION_ROADMAP.md**](file:///c:/Users/ETIMAD%20MART/Etimad-Suit/docs/IMPLEMENTATION_ROADMAP.md)  
   9-phase engineering execution plan with milestones, acceptance criteria, test matrices, and cutover protocols.
6. [**KNOWN_RISKS_AND_DECISIONS.md**](file:///c:/Users/ETIMAD%20MART/Etimad-Suit/docs/KNOWN_RISKS_AND_DECISIONS.md)  
   Formal Architecture Decision Records (ADRs) and comprehensive risk management log covering concurrency, security, third-party courier APIs, and data integrity.

---

## 🛠️ Quick Start (Development)

1. Clone or initialize the repository.
2. Create your local development environment:
   ```bash
   cp .env.example .env
   ```
3. Install dependencies across workspaces:
   ```bash
   npm install
   ```
4. Start backend in development mode:
   ```bash
   npm run dev:backend
   ```
5. Run the automated test suite:
   ```bash
   npm run test:backend
   ```
