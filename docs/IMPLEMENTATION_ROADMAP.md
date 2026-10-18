# Implementation Roadmap & Milestone Execution Plan

> **Status:** APPROVED ENGINEERING ROADMAP  
> **Methodology:** Test-Driven Phased Modular Monolith Build  
> **Target Release:** Etimad Suit v1.0.0 Multi-Tenant Production  

---

## 1. Overview & Phasing Strategy

To safely transition from two single-tenant applications into a unified SaaS product without operational disruption, development is structured across **9 sequential phases**. Each phase produces a deployable, tested milestone with an explicit Definition of Done.

```mermaid
gantt
    title Etimad Suit SaaS Implementation Roadmap
    dateFormat  YYYY-MM-DD
    section Discovery & Foundations
    Phase 1: Audits & Architectural Blueprints     :done,    p1, 2026-10-18, 1d
    Phase 2: Tenant Engine, RBAC & Isolation Tests :active,  p2, 2026-10-19, 3d
    section Core Authoritative Engine
    Phase 3: Catalog, Inventory & Canonical Orders :         p3, after p2, 4d
    Phase 4: Purchases, Double-Entry Finance & Logistics :   p4, after p3, 4d
    section Omnichannel & Frontends
    Phase 5: Retail POS & Wholesale Engine        :         p5, after p4, 3d
    Phase 6: Multi-Tenant Storefront & Domains     :         p6, after p5, 3d
    section Extensibility & Monetization
    Phase 7: Apps Framework & Courier Adapters     :         p7, after p6, 3d
    Phase 8: Subscriptions, Plans & Admin Console  :         p8, after p7, 3d
    section Production Readiness
    Phase 9: Staged Migration, Load Tests & Launch :         p9, after p8, 4d
```

---

## 2. Phase-by-Phase Deliverables & Exit Criteria

### Phase 1: Repository Audit, Feature Mapping & Architecture Documents (Current Milestone)
- **Objectives**: Inspect all code paths, package versions, and schemas across both repositories; establish the new `Etimad-Suit` repository; create complete architectural blueprints.
- **Key Deliverables**:
  1. `docs/ETIMAD_SUIT_ARCHITECTURE.md`
  2. `docs/EXISTING_FEATURE_MAPPING.md`
  3. `docs/DATABASE_AND_MIGRATION_PLAN.md`
  4. `docs/API_AND_PERMISSION_MATRIX.md`
  5. `docs/IMPLEMENTATION_ROADMAP.md`
  6. `docs/KNOWN_RISKS_AND_DECISIONS.md`
  7. `.env.example`, `.gitignore`, root `package.json`, and repository layout.
- **Exit Criteria**: All 6 architectural documents committed to `Etimad-Suit` repo; source features classified; repository creation steps documented for owner.

---

### Phase 2: Tenant Model, Permissions & Automated Isolation Tests
- **Objectives**: Build the authoritative core authentication, tenant resolution middleware, and automated isolation tests proving Seller A cannot access Seller B's records.
- **Key Deliverables**:
  - `User`, `Tenant`, and `TenantMembership` models with compound tenant indexes.
  - JWT authentication with secure HTTP-only cookies and role permissions.
  - `tenantContext` middleware resolving tenant from token or host headers.
  - Automated tenant isolation test suite (`backend/tests/integration/tenant-isolation.test.js`):
    - Test: Seller A cannot read, query, update, or delete Seller B's products or orders.
    - Test: Identifier-guessing attacks across tenants return 404/403.
- **Exit Criteria**: 100% of tenant isolation tests passing in CI/CD pipeline.

---

### Phase 3: Unified Product, Pricing, Inventory & Order Services
- **Objectives**: Implement the core business engine—canonical products, authoritative inventory ledger, and server-authoritative order processing.
- **Key Deliverables**:
  - Unified `Product` model merging e-commerce media with IMS multi-channel pricing.
  - `StockLedger` service executing conditional atomic decrements (`$inc: { stock: -qty }` with `{ stock: { $gte: qty } }`).
  - Canonical `Order` model supporting `channel: 'online'`, `'retail'`, and `'wholesale'`.
  - Server-side pricing engine recalculating discounts, delivery charges, and taxes.
  - Automated concurrency test (`backend/tests/integration/stock-concurrency.test.js`):
    - Test: 20 simultaneous requests competing for the last 5 inventory units correctly fulfill 5 and reject 15 without negative stock.
- **Exit Criteria**: No overselling under load; pricing strictly server-authoritative.

---

### Phase 4: Purchases, Double-Entry Finance & Logistics Workflows
- **Objectives**: Port and tenant-scope the audited IMS purchase batching, landed cost, double-entry financial accounting, and parcel workflows.
- **Key Deliverables**:
  - `PurchaseBatch` module with freight/courier landed cost per-unit allocation.
  - `FinanceLedger` double-entry transaction engine (Petty Cash vs Bank Accounts).
  - Real-time Balance Sheet and Business Valuation service.
  - Shipping `Parcel` management and return inspection grading (restockable vs damaged).
- **Exit Criteria**: Double-entry ledger balances match: $\text{Assets} = \text{Liabilities} + \text{Equity}$.

---

### Phase 5: Retail POS & Wholesale Workflows
- **Objectives**: Deliver fast checkout for physical retail counters and B2B wholesale management.
- **Key Deliverables**:
  - Retail POS module: Barcode scanning, rapid keyboard shortcuts, split payments (Cash + Card), offline-tolerant cart, receipt generation.
  - Cashier shift tracking and end-of-day drawer reconciliation.
  - Wholesale module: Customer khata/receivables, custom price lists, volume discount tiers, quotation-to-order conversion, and credit limit enforcement.
- **Exit Criteria**: POS sale immediately updates stock in `StockLedger` and records income in `FinanceLedger` in a single transaction.

---

### Phase 6: Multi-Tenant Storefront, Theming & Custom Domains
- **Objectives**: Deliver dynamic, branded e-commerce storefronts for each tenant.
- **Key Deliverables**:
  - Multi-tenant storefront client (`apps/storefront/`) reading tenant theme, logos, colors, and banners.
  - Subdomain routing (e.g. `seller.etimadsuit.com`) and custom domain verification engine (DNS TXT verification).
  - Shopping cart, guest checkout, Pakistani mobile number validator, and order tracking page.
- **Exit Criteria**: Changing Tenant A's logo or theme has 0% effect on Tenant B.

---

### Phase 7: Apps Framework & Verified Provider Adapters
- **Objectives**: Create the pluggable integration framework and wire the first verified courier provider.
- **Key Deliverables**:
  - `ICourierAdapter` and `IPaymentAdapter` interfaces.
  - `AppConnection` model storing AES-256 encrypted merchant credentials.
  - Refactored, production-ready `LcsAdapter` (Leopards) and `PostExAdapter`.
  - Idempotent webhook receiver with HMAC signature validation.
  - Manual booking fallback for unintegrated couriers.
- **Exit Criteria**: Automated test with mock courier API validates shipment booking, label generation, and tracking callbacks without blocking order saves during simulated outages.

---

### Phase 8: Subscriptions, Plans & Platform Administration
- **Objectives**: Implement monetization, plan quotas, and platform owner management.
- **Key Deliverables**:
  - SaaS `Plan` model with configurable quotas (max staff, max products, custom domain toggle, apps access).
  - Backend entitlement enforcement middleware rejecting operations exceeding plan limits.
  - `apps/platform-admin/` dashboard for managing merchant accounts, plans, and support.
- **Exit Criteria**: Exceeding plan product limits returns 402/403 with upgrade instructions without deleting data.

---

### Phase 9: Staged Migration, Staging Verification & Launch
- **Objectives**: Migrate production data from both legacy databases into staging, verify reconciliation, and perform controlled cutover.
- **Key Deliverables**:
  - Automated, resumable migration scripts in `scripts/migration/`.
  - Staging environment populated with reconciled historical data for flagship tenant `etimadmart`.
  - Reconciliation audit report verifying product counts, stock balances, customer khatas, and financial balances.
  - Documented DNS cutover and rollback protocol.
- **Exit Criteria**: 100% reconciliation match; zero data loss; live staging sign-off from platform owner.

---

## 3. Standard End-of-Phase Reporting Template

At the conclusion of each phase, a formal status report will be delivered covering:
1. **Files Created & Modified**: Complete list of touched repository files.
2. **Features Completed**: User-facing and architectural capabilities delivered.
3. **Automated Tests Executed**: Test suite names, execution commands, and verified results.
4. **Unresolved Risks & Blockers**: Any technical hurdles or dependencies.
5. **Next Phase Goals**: Target objectives for the immediate next phase.
