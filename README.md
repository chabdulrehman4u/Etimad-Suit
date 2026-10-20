# Etimad Suit — Multi-Tenant SaaS Platform

Etimad Suit is an enterprise-grade, multi-tenant SaaS application that unifies omnichannel e-commerce, retail point-of-sale (POS), wholesale distribution, inventory management, logistics adapters, and financial accounting into **ONE authoritative backend and single source of business truth**.

Consolidated from two legacy systems (`Etimad-Mart-Ecommerce-Solution-2` and `Etimad-Mart-IMS`), Etimad Suit allows every subscribing merchant to operate an independent, highly customized business with dynamic storefront branding, real-time stock synchronization, double-entry financial accounting, and zero cross-tenant data leakage.

---

## 🎯 Architecture Pillars

1. **One Authoritative Backend**: All sales channels (`online`, `retail`, `wholesale`) feed into one canonical order pipeline and one authoritative stock ledger.
2. **Absolute Tenant Isolation**: Every seller is an independent business entity. Every data record is tenant-scoped with backend authorization enforcement and compound tenant-scoped indexes.
3. **Inventory Integrity & Atomic Concurrency**: No overselling. Stock mutations use conditional atomic operations with immutable audit history tracking in `StockLedger`.
4. **Server-Authoritative Pricing**: Totals, volume pricing, wholesale tiers, coupons, shipping, and taxes are strictly calculated and validated on the backend.
5. **Super-Dynamic Storefront CMS**: Store colors, branding, typography, announcements, hero banners, section order, footer columns, and real-time functional feature flags can be reconfigured dynamically at any time without code redeployments.
6. **Pluggable Integration Architecture**: Courier (LCS, PostEx, M&P, TCS), payment, and communication providers are integrated via abstract provider adapters, storing AES-256-GCM encrypted credentials per tenant with graceful outage fallback.
7. **Double-Entry Financial Accounting**: Real-time business valuation, cost-of-goods-sold (COGS) tracking, accounts payable, accounts receivable, balance sheets, and cash/bank reconciliation.
8. **Plan Quotas & Entitlements**: Automated subscription tier limits (products, orders/mo, staff users, custom domains) enforced by backend middleware.

---

## 📁 Repository Structure

```text
Etimad-Suit/
├── apps/
│   ├── storefront/          # Customer-facing dynamic e-commerce web application (Port 3000)
│   ├── seller-dashboard/    # Merchant operations console: POS, CMS, Orders, Finance (Port 3001)
│   └── platform-admin/      # SaaS super-admin console: Tenant governance & Subscriptions (Port 3002)
├── backend/
│   ├── src/
│   │   ├── modules/         # Modular monolith service boundaries
│   │   │   ├── auth/        # JWT auth, user identity, 10 distinct RBAC roles
│   │   │   ├── tenants/     # Tenant provisioning, custom domains, settings
│   │   │   ├── subscriptions/# Plans, entitlements, quotas, usage tracking
│   │   │   ├── products/    # Unified product catalog, variants, categories
│   │   │   ├── inventory/   # Authoritative stock ledger, adjustments, transfers
│   │   │   ├── orders/      # Canonical orders across online, POS, and wholesale
│   │   │   ├── storefront/  # Dynamic theme builder, CMS homepage sections, public APIs
│   │   │   ├── pos/         # Retail point-of-sale rapid checkout, split payments & shift logs
│   │   │   ├── wholesale/   # B2B pricing tiers, customer khata, quotations & credit limits
│   │   │   ├── purchases/   # Purchase batches, landed cost freight pro-rating, receiving
│   │   │   ├── finance/     # Double-entry ledger, balance sheet, valuation
│   │   │   ├── logistics/   # Shipping parcels, courier dispatch, condition-graded returns
│   │   │   ├── apps/        # Pluggable adapter framework (LCS, PostEx) with AES-256 encryption
│   │   │   └── platformAdmin/# Super-admin directory, plan configurations & MRR analytics
│   │   ├── middleware/      # Tenant context, auth guards, rate-limiting, quota enforcement
│   │   ├── config/          # Environment configuration and validation
│   │   ├── server.js        # Standalone server entrypoint with Mongoose connection
│   │   └── app.js           # Express app factory with security middleware
│   └── tests/               # 79 automated tests across 13 test suites (100% pass rate)
├── packages/
│   ├── shared-types/        # Canonical TypeScript / JSDoc shared domain models & constants
│   ├── shared-validation/   # Universal schema validation (Pakistani phone, email, slug)
│   └── ui/                  # Dynamic CSS variable theme injector & PKR formatters
├── docs/                    # Architectural blueprints and engineering guides
├── scripts/                 # Staged zero-downtime data migration & reconciliation audit tools
├── .env.example             # Documented environment template with placeholders
├── .gitignore
└── package.json
```

---

## 🚀 Running the Applications

### Prerequisites
- Node.js >= 18 (Tested on v24)
- MongoDB >= 6.0 running locally or via connection string

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Start Development Servers
You can run any application individually or all concurrently:

| Application | Command | Default URL |
| :--- | :--- | :--- |
| **Backend API Server** | `npm run dev:backend` | `http://localhost:5000` |
| **Public Storefront** | `npm run dev:storefront` | `http://localhost:3000` |
| **Merchant Dashboard & POS** | `npm run dev:seller` | `http://localhost:3001` |
| **Platform Super-Admin** | `npm run dev:admin` | `http://localhost:3002` |

### 4. Build All Applications for Production
```bash
npm run build
```

---

## 🧪 Automated Test Suite (79 Tests / 100% Pass Rate)

Etimad Suit features a comprehensive test suite covering all critical business domains, isolation boundaries, and race conditions:

```bash
npm test
```

### Verified Test Suites:
- `tests/integration/tenant-isolation.test.js` — Cross-tenant query blocking, unauthorized data rejection.
- `tests/integration/canonical-orders.test.js` — Multi-channel order creation, state transitions, ledger deduction.
- `tests/integration/pricing.test.js` — Authoritative server pricing, tiered volume discounts, shipping rules.
- `tests/integration/stock-concurrency.test.js` — Atomic conditional updates preventing inventory overselling.
- `tests/integration/purchases-finance-logistics.test.js` — Landed freight pro-rating, double-entry balance sheets, return inspections.
- `tests/integration/pos-and-wholesale.test.js` — Barcode scanner lookup, split payments, cashier shifts, wholesale credit limits.
- `tests/integration/apps-and-couriers.test.js` — AES-256 encrypted courier credentials, LCS/PostEx adapters, outage fallbacks.
- `tests/integration/subscriptions-and-admin.test.js` — Plan limits, quota enforcement middleware, platform-wide metrics.
- `tests/integration/dynamic-storefront.test.js` — Live theme colors, dynamic homepage CMS sections, COD checkout, order tracking.
- `tests/integration/staged-migration.test.js` — Zero-loss migration from legacy Ecom and IMS databases.
- `tests/unit/rbac-middleware.test.js`, `tests/unit/roles.test.js`, `tests/unit/tenant-middleware.test.js` — Unit RBAC rules.

---

## 🎨 Super-Dynamic Storefront CMS System

Merchants can customize their entire brand experience in real time via the **Storefront Customizer** in `apps/seller-dashboard`:

- **Design Colors**: Instant live color preview with dynamic CSS custom properties (`--brand-primary`, `--brand-secondary`, `--brand-accent`, `--brand-bg`, `--brand-surface`, `--brand-text`).
- **Typography & Font Sizes**: Configurable heading/body font families and scale.
- **Announcement Bar**: Enable/disable, message text, link URL, background/text colors.
- **Hero Banners**: Title, subtitle, CTA text, CTA destination, background banner image.
- **Homepage Section Builder**: Dynamic section toggles and drag-and-drop / ordering (`HERO_BANNER`, `FEATURED_PRODUCTS`, `CATEGORIES_GRID`, `PROMOTIONAL_BANNER`, `NEWSLETTER`).
- **Dynamic Footer Builder**: Custom copyright, social links (Facebook, Instagram, WhatsApp, Twitter), and custom link columns (Customer Care, About Us, Policies).
- **Functional Feature Flags**: Toggle Cart Drawer, WhatsApp Chat Button, Customer Reviews, Product Search, and Guest Checkout dynamically without touching code.

---

## 🔄 Legacy Data Migration & Reconciliation

A staged, zero-data-loss migration pipeline is provided in `scripts/migration/` to migrate existing production records from both legacy repositories into the unified Etimad Suit tenant model:

```bash
# Dry run migration with detailed logs:
node scripts/migration/runMigration.js --dry-run

# Execute full staged migration:
node scripts/migration/runMigration.js
```

### Migration Stages:
1. **Flagship Tenant Provisioning**: Automatically sets up `etimad-mart` tenant with verified branding and enterprise entitlements.
2. **Users & Staff**: Preserves existing bcrypt password hashes (`$2a$` / `$2b$`) with 0 password resets required; maps legacy roles to unified RBAC permissions.
3. **Products & Inventory Reconciliation**: Merges IMS physical stock records with E-commerce rich media, descriptions, and categories.
4. **Customers & Suppliers**: Normalizes Pakistani phone numbers (`03xx-xxxxxxx` / `+923xxxxxxxxx`) and preserves supplier khata ledgers.
5. **Orders & Transactions**: Converts legacy bills and sales into canonical `Order` records and balances the double-entry `FinanceLedger`.
6. **Zero Orphan Audit**: Automatically verifies 0 unmapped foreign keys before cutover.

---

## 📚 Core Architecture Documents

Detailed engineering specifications are available in the [`docs/`](docs/) directory:

1. [**ETIMAD_SUIT_ARCHITECTURE.md**](docs/ETIMAD_SUIT_ARCHITECTURE.md) — Complete system architecture, service boundaries, and state machines.
2. [**EXISTING_FEATURE_MAPPING.md**](docs/EXISTING_FEATURE_MAPPING.md) — Line-by-line audit and feature mapping of both legacy repositories.
3. [**DATABASE_AND_MIGRATION_PLAN.md**](docs/DATABASE_AND_MIGRATION_PLAN.md) — Unified data models, indexing strategy, and zero-downtime cutover.
4. [**API_AND_PERMISSION_MATRIX.md**](docs/API_AND_PERMISSION_MATRIX.md) — Comprehensive REST API endpoints and 10-role RBAC matrix.
5. [**IMPLEMENTATION_ROADMAP.md**](docs/IMPLEMENTATION_ROADMAP.md) — 9-phase execution plan and completion log.
6. [**KNOWN_RISKS_AND_DECISIONS.md**](docs/KNOWN_RISKS_AND_DECISIONS.md) — Architecture Decision Records (ADRs) and risk mitigations.

---

## 🔒 Security & Data Integrity

- **Tenant Scoping Enforcement**: All database queries derive `tenantId` strictly from the verified JWT / session context (`req.tenantId` or `req.scopeTenant()`), never from client input.
- **Credential Encryption**: Third-party API keys (e.g., LCS, PostEx) are encrypted with `AES-256-GCM` using a secure 256-bit key and initialization vector.
- **Rate Limiting & Headers**: Pre-configured with Helmet HTTP headers and Express rate limiting.
- **Double-Entry Balance Guarantee**: Financial transactions enforce the fundamental invariant $\text{Assets} = \text{Liabilities} + \text{Equity}$.
