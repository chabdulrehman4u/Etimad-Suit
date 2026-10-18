# Architecture Decisions Records (ADRs) & Risk Management Log

> **Status:** APPROVED DECISIONS & RISK CONTROLS  
> **Target Project:** Etimad Suit Multi-Tenant SaaS Platform  

---

## 1. Architectural Decision Records (ADRs)

### ADR-001: Modular Monolith vs Microservices
- **Context**: The existing repositories are two separate Express applications that communicate via an unreliable HTTP bridge. We need an integrated SaaS backend for e-commerce, POS, wholesale, and inventory.
- **Decision**: Adopt a **Modular Monolith** architecture with strict service boundaries within a single codebase.
- **Rationale**:
  - The team and operational infrastructure benefit from a single deployment unit, simplified debugging, and straightforward ACID database transactions.
  - Microservices would introduce distributed transaction complexity (Saga pattern) across inventory and orders without a documented business need.
- **Consequences**: Internal domain modules (`inventory`, `orders`, `finance`) must interact only through exported service functions, never through ad-hoc direct database tampering.

---

### ADR-002: Multi-Tenancy Strategy: Shared Database with Tenant-Scoped Compound Indexes
- **Context**: Etimad Suit supports multiple independent merchants. We evaluated Database-per-Tenant vs Shared-Database-with-Tenant-Discriminator.
- **Decision**: Implement a **Shared Database with Strict Tenant-Scoped Discriminator (`tenantId`)** and compound unique indexes.
- **Rationale**:
  - High operational density, simplified automated migrations, low hosting overhead, and native cross-tenant reporting for platform owners.
  - Database-per-tenant adds significant operational overhead (connection pooling management across hundreds of databases, dynamic migrations) without proportionate gain at this stage.
- **Consequences**: Every single query must enforce `tenantId`. Automated tenant-isolation integration tests are mandatory before production release.

---

### ADR-003: Technology Stack Standardization
- **Context**: Ecommerce used Node.js CommonJS with Mongoose 7.6; IMS used Node.js ES Modules with Mongoose 8.0.
- **Decision**: Standardize on **Node.js (v20+ LTS) with Native ES Modules (`"type": "module"`), Express 4.x/5.x, Mongoose 8.x, and React 18 + Vite + Tailwind CSS**.
- **Rationale**:
  - Aligns with modern JavaScript standards, enables tree-shaking, and unifies shared types and validation packages across backend and frontends.
- **Consequences**: Legacy CommonJS files from Ecommerce will be migrated to clean ES module syntax (`import`/`export`).

---

### ADR-004: Canonical Omnichannel Order Model & Unified Stock Ledger
- **Context**: In the legacy systems, Ecommerce maintained `Order`, IMS maintained `Bill` (for retail) and `SellerDispatch` (for consignments), each decrementing stock independently and causing stock drift.
- **Decision**: Enforce **ONE Canonical Order Model** (`channel: 'online' | 'retail' | 'wholesale'`) and **ONE Authoritative Stock Ledger** (`StockLedger`).
- **Rationale**:
  - Eliminates stock synchronization race conditions and provides a single audit trail for every item sold, returned, or received.
- **Consequences**: Retail POS sales and wholesale orders flow through the canonical order pipeline with channel-specific state transitions.

---

### ADR-005: Server-Authoritative Pricing Engine
- **Context**: The legacy e-commerce checkout trusted `req.body.totalPrice` and `req.body.deliveryCharges` sent from the frontend browser.
- **Decision**: All totals, volume tiers, wholesale discounts, delivery fees, taxes, and grand totals are calculated and validated strictly on the backend.
- **Rationale**:
  - Prevents price tampering, client-side discount manipulation, and currency inconsistencies.
- **Consequences**: Client applications submit only product IDs, quantities, and coupon codes; the server responds with authoritative line items and totals.

---

### ADR-006: Abstract Provider Adapter Framework for Third-Party Couriers
- **Context**: Courier APIs (Leopards, PostEx, M&P) were previously hardcoded directly into controllers, meaning an API error or timeout could crash or fail order creation.
- **Decision**: Encapsulate all external logistics and payment gateways behind an abstract provider adapter interface (`ICourierAdapter`).
- **Rationale**:
  - Insulates core order processing from third-party courier downtime.
  - Allows merchants to configure their own courier credentials in an Apps tab without code changes.
- **Consequences**: Couriers are called asynchronously after an order is safely recorded. If a courier API fails, the order remains in `Confirmed` state for automated retry.

---

## 2. Comprehensive Risk Management Log

| # | Risk Description | Severity | Likelihood | Impact | Concrete Mitigation Strategy |
| :- | :--- | :---: | :---: | :---: | :--- |
| **R-1** | **Inventory Overselling Under High Concurrency**<br>Simultaneous checkout requests for the same stock unit could result in negative inventory. | **CRITICAL** | HIGH | Business Loss, Customer Disputes | Execute stock deductions exclusively using conditional atomic updates (`$inc: { stock: -qty }` with `{ stock: { $gte: qty } }`). Covered by automated load tests in Phase 3. |
| **R-2** | **Cross-Tenant Data Leakage**<br>A merchant accessing another merchant's orders, revenue, or customer details through manipulated IDs. | **CRITICAL** | MED | Severe Privacy & Compliance Breach | 1. Never trust tenant ID from frontend payloads.<br>2. Derive tenant strictly from verified JWT claims or verified domain host.<br>3. Enforce tenant scoping at middleware, service, and database compound index layers.<br>4. Automated isolation test suite in CI. |
| **R-3** | **Third-Party Courier Outages Blocking Sales**<br>Leopards or PostEx API down, timing out, or rejecting credentials during customer checkout. | **HIGH** | HIGH | Lost Sales & Cart Abandonment | Decouple order placement from courier booking. Store orders in `Confirmed` status and execute courier dispatch asynchronously via retryable background jobs. Fallback to manual consignment booking. |
| **R-4** | **Data Drift During Staged Database Migration**<br>Discrepancies in product catalog, physical stock balances, or customer khata balances during migration. | **HIGH** | MED | Accounting & Stock Discrepancies | 1. Execute migrations only against staging backups.<br>2. Run mathematical reconciliation scripts verifying product count, total stock units, and ledger balances before live cutover.<br>3. Zero live modifications without explicit owner sign-off. |
| **R-5** | **Storefront SEO & Traffic Degradation**<br>Moving `etimadmart.com` to the new architecture could break existing product indexing if URLs change. | **HIGH** | MED | Drop in Search Traffic & Revenue | 1. Preserve exact canonical product slug structure (`/product/:slug`).<br>2. Retain dynamic page slugs and metadata.<br>3. Implement automated 301 permanent redirects for legacy paths. |
| **R-6** | **Courier Webhook Forgery & Duplicate Callbacks**<br>Malicious actors sending fake delivery updates, or couriers retrying delivery webhooks causing duplicate payments. | **MED** | MED | Financial Misreporting | Authenticate webhooks using HMAC secret signatures. Enforce idempotency using unique callback transaction hashes. |
