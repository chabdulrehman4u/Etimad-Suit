# Existing Feature Mapping & Source Repository Audit

> **Status:** AUDIT COMPLETED & SOURCE-TO-TARGET SPECIFICATION  
> **Source 1:** [Etimad-Mart-Ecommerce-Solution-2](https://github.com/chabdulrehman4u/Etimad-Mart-Ecommerce-Solution-2)  
> **Source 2:** [Etimad-Mart-IMS](https://github.com/chabdulrehman4u/Etimad-Mart-IMS)  
> **Target Project:** Etimad Suit Multi-Tenant SaaS Platform  

---

## 1. Audit Overview & Repositories Evaluation

### 1.1 Source Repository 1: E-Commerce Solution 2
- **Architecture**: Single-tenant B2C online shopping platform.
- **Backend Stack**: Node.js (CommonJS), Express 4.18, Mongoose 7.6, MongoDB 4.17 driver.
- **Frontend Stack**: React 18, Vite 6, Redux Toolkit, Tailwind CSS, Lucide / React Icons, Keen Slider.
- **Key Modules**: Product catalog with rich media, Category/Subcategory hierarchy, Cart & Guest Checkout, LCS & PostEx courier APIs, Dynamic Pages, Blog, CMS, Customer Reviews.
- **Critical Flaws Found in Audit**:
  1. **Non-authoritative Pricing**: Server accepted client-submitted `totalPrice` and `deliveryCharges` without independent server-side re-calculation.
  2. **Non-atomic Stock Mutation**: Stock checks were decoupled from decrements (`Product.findById` followed by `Product.bulkWrite`), vulnerable to race-condition overselling.
  3. **Ad-hoc Bridge to IMS**: Implemented as an asynchronous fire-and-forget HTTP POST in `order.js` to `https://etimad-mart-api.onrender.com/api/storefront/etimadmart/orders`. It caught errors silently, causing order and inventory drift.
  4. **Single-Tenant Hardcoding**: Assumed a single merchant with global collections and single-admin authorization.

### 1.2 Source Repository 2: Inventory Management System (IMS)
- **Architecture**: Single-tenant back-office ERP/inventory management system.
- **Backend Stack**: Node.js (ES Modules `"type": "module"`), Express 4.18, Mongoose 8.0.
- **Frontend Stack**: React 18, Vite 7, TanStack React Query v5, Tailwind CSS, Lucide Icons.
- **Key Modules**: Retail Billing & Invoicing, Seller Consignment & Commission Ledger, Purchase Batches with Landed Cost Allocation, Stock Ledger (`StockHistory`), Double-entry Financial Accounting, LCS Courier Tracking, Returns Inspection.
- **Key Strengths Found in Audit**:
  1. **Robust Stock Guard**: Uses conditional atomic decrements (`Product.findOneAndUpdate({ _id, stock: { $gte: qty } })`) with compensating rollbacks.
  2. **Double-Entry Financial Engine**: Implements balanced ledger transactions (`FinanceLedger`), balance sheet calculations, and real-time business valuation.
  3. **Landed Cost Calculation**: Computes effective product unit costs by allocating freight and courier expenses to purchase batches.
- **Critical Flaws Found in Audit**:
  1. **No Real Multi-Tenancy**: All data (sellers, products, bills, bank accounts) resided in a global shared namespace without merchant tenant isolation.
  2. **Dual-system Divergence**: Implemented competing Product schemas (flat model vs rich variants) and competing Order models (`Bill` vs `Order`).

---

## 2. Feature Classification Matrix

Every feature is classified into one of four actions:
- **`REUSE`**: Working functionality copied with minimal adaptions (e.g., utility functions, courier endpoints, calculation math).
- **`REFACTOR`**: Strong domain logic retained but restructured for multi-tenancy, server-side validation, or modular service boundaries.
- **`REPLACE`**: Unsatisfactory or insecure implementation replaced with a robust, enterprise-grade pattern.
- **`RETIRE`**: Legacy, dead, or duplicate code removed completely.

---

## 3. Comprehensive Module-by-Module Feature Mapping

### 3.1 Authentication, Identity & Tenant Scoping

| Existing Feature & Source Path | Current State | Target Module | Action | Technical Rationale & Refactoring Plan |
| :--- | :--- | :--- | :--- | :--- |
| **Ecommerce User Auth**<br>`Ecommerce/backend/routes/user.js`<br>`Ecommerce/backend/models/user.js` | Single admin or public user, cookie named `token`, bcrypt. | `backend/src/modules/auth/`<br>`User.js` | **REFACTOR** | Consolidate into unified User model supporting global superadmins and tenant-scoped staff memberships. |
| **IMS Admin & Seller Auth**<br>`IMS/backend/routes/auth.js`<br>`IMS/backend/models/Admin.js` | Separate `Admin` and `Seller` models. Colliding cookie name `token`. | `backend/src/modules/auth/`<br>`backend/src/modules/tenants/` | **REPLACE** | Replace dual-entity auth with unified Identity + `TenantMembership` entity having role-based permissions (`owner`, `manager`, `cashier`, `accountant`). |
| **Tenant Isolation Engine**<br>`IMS/backup-oct11/middleware/tenant.js` | Prototype regex slug lookup on URL parameters. | `backend/src/middleware/tenant.js` | **REFACTOR** | Secure tenant resolution via verified host header (subdomains/custom domains) and authenticated JWT claims. Enforce database-level scoping on all queries. |

### 3.2 Product Catalog & Pricing

| Existing Feature & Source Path | Current State | Target Module | Action | Technical Rationale & Refactoring Plan |
| :--- | :--- | :--- | :--- | :--- |
| **Rich Ecommerce Product Catalog**<br>`Ecommerce/backend/models/product.js` | Rich descriptions, variants, Cloudinary images, FAQs, DOD deals. | `backend/src/modules/products/` | **REFACTOR** | Merge with IMS pricing fields (`costPrice`, `wholesalePrice`, `retailPrice`, `websitePrice`, `barcode`). Scope to `tenantId`. |
| **IMS Product Model & Barcodes**<br>`IMS/backend/models/Product.js` | Flat product schema with barcode, originalPrice, wholesalePrice, retailPrice. | `backend/src/modules/products/` | **REFACTOR** | Standardize SKU and Barcode indexing with compound index `{ tenantId: 1, barcode: 1 }`. Support variants under master products. |
| **Categories & Brands**<br>`Ecommerce/backend/models/category.js`<br>`Ecommerce/backend/models/brand.js` | Global category & brand collections. | `backend/src/modules/products/` | **REFACTOR** | Add `tenantId`. Provide default category sets for newly onboarded merchants. |
| **Client-Side Pricing & Cart**<br>`Ecommerce/frontend/src/Pages/Checkout.jsx` | Submits calculated totals directly to backend. | `backend/src/modules/orders/` | **REPLACE** | Client submits line items and coupon only; backend recalculates authoritative totals, discounts, and taxes. |

### 3.3 Authoritative Inventory Management

| Existing Feature & Source Path | Current State | Target Module | Action | Technical Rationale & Refactoring Plan |
| :--- | :--- | :--- | :--- | :--- |
| **IMS Stock History Ledger**<br>`IMS/backend/models/StockHistory.js`<br>`IMS/backend/controllers/billController.js` | Strong conditional atomic decrement (`stock: { $gte: qty }`) with rollback. | `backend/src/modules/inventory/`<br>`StockLedger.js` | **REUSE** | Standardize across all channels. Rename to `StockLedger`, add warehouse location tracking and tenant scoping. |
| **Ecommerce Stock Mutation**<br>`Ecommerce/backend/controllers/order.js` | Blind `bulkWrite` without conditional check on stock. Overselling bug. | `backend/src/modules/inventory/` | **REPLACE** | Replace with unified `InventoryService.reserveStock()` and `InventoryService.deductStock()` atomic primitives. |
| **Warehouse Transfers** | Not implemented in either system. | `backend/src/modules/inventory/` | **NEW** | Implement multi-warehouse transfer workflows with in-transit states. |

### 3.4 Canonical Orders, POS & Wholesale

| Existing Feature & Source Path | Current State | Target Module | Action | Technical Rationale & Refactoring Plan |
| :--- | :--- | :--- | :--- | :--- |
| **Ecommerce Order Model**<br>`Ecommerce/backend/models/order.js` | Online customer shipping, status enum, courier metadata. | `backend/src/modules/orders/` | **REFACTOR** | Adopt as baseline for online channel within canonical `Order` model. Add channel identifier and financial status. |
| **IMS Invoicing / Billing (POS)**<br>`IMS/backend/controllers/billController.js`<br>`IMS/frontend/src/pages/Billing.jsx` | Fast billing, price type selection, receipt generation, seller commission. | `backend/src/modules/pos/` | **REFACTOR** | Migrate into dedicated Retail POS module. Bills become canonical `Order` records with `channel: 'retail'`. |
| **Wholesale / Bulk Tier Engine**<br>`IMS/backup-oct11/feat(billing)` | Tiered quantity bulk pricing prototype. | `backend/src/modules/wholesale/` | **REFACTOR** | Formalize into Wholesale module with customer price lists, credit limits, minimum order quantities (MOQ), and khata statements. |
| **Ecommerce-to-IMS Bridge**<br>`Ecommerce/backend/controllers/order.js` (Lines 190-218) | Fire-and-forget axios POST to Render endpoint. | N/A | **RETIRE** | Obsolete. Replaced by native internal service call in unified backend. |

### 3.5 Purchases, Receiving & Inbound Stock

| Existing Feature & Source Path | Current State | Target Module | Action | Technical Rationale & Refactoring Plan |
| :--- | :--- | :--- | :--- | :--- |
| **Purchase Batches & Landed Cost**<br>`IMS/backend/controllers/purchaseBatchController.js`<br>`IMS/backend/models/PurchaseBatch.js` | Landed cost allocation across units, supplier payables, bank deductions. | `backend/src/modules/purchases/` | **REUSE** | Highly functional. Retain mathematical logic; add `tenantId` and multi-warehouse receiving support. |
| **Purchase Orders (Book PO)**<br>`IMS/backend/controllers/bookPOController.js` | Inbound PO planning and status tracking. | `backend/src/modules/purchases/` | **REFACTOR** | Connect directly to receiving workflow to convert approved POs into Purchase Batches. |

### 3.6 Finance, Accounting & Business Valuation

| Existing Feature & Source Path | Current State | Target Module | Action | Technical Rationale & Refactoring Plan |
| :--- | :--- | :--- | :--- | :--- |
| **Double-Entry Finance Ledger**<br>`IMS/backend/services/financeService.js`<br>`IMS/backend/models/FinanceLedger.js` | Double-entry journal, Petty Cash vs Bank Account, Accounts Payable/Receivable. | `backend/src/modules/finance/` | **REUSE** | Comprehensive accounting logic. Refactor to ensure all entries are scoped to `tenantId`. |
| **Real-Time Business Valuation**<br>`IMS/backend/controllers/financeController.js` | Computes live assets, inventory worth, equity, and retained earnings. | `backend/src/modules/finance/` | **REUSE** | Scope to tenant. Power the financial summary dashboard for seller owners. |
| **Expenses & Ad Spend Tracking**<br>`IMS/backend/controllers/expenseController.js`<br>`IMS/backend/controllers/adSpendController.js` | Tracks operational expenses, marketing spend, and deduction from cash/banks. | `backend/src/modules/finance/` | **REUSE** | Retain with tenant isolation. |

### 3.7 Shipping, Courier Integrations & Returns

| Existing Feature & Source Path | Current State | Target Module | Action | Technical Rationale & Refactoring Plan |
| :--- | :--- | :--- | :--- | :--- |
| **Leopards Courier Service (LCS)**<br>`Ecommerce/backend/services/lcs.js`<br>`IMS/backend/services/lcsService.js` | Working REST client for LCS merchant API. Duplicated in both codebases. | `backend/src/modules/shipping/`<br>`adapters/LcsAdapter.js` | **REFACTOR** | Consolidate into unified `LcsAdapter` implementing `ICourierAdapter`. Load credentials dynamically per tenant. |
| **PostEx Integration**<br>`Ecommerce/backend/services/postexService.js` | Order creation, tracking, city lookup for PostEx. | `backend/src/modules/shipping/`<br>`adapters/PostExAdapter.js` | **REFACTOR** | Encapsulate into `PostExAdapter` implementing `ICourierAdapter`. |
| **M&P Courier Specification**<br>`IMS/backend/MNP API DO.txt` | Complete official API manual documentation for Muller & Phipps. | `backend/src/modules/shipping/`<br>`adapters/MnpAdapter.js` | **NEW** | Implement `MnpAdapter` based on the documented specification. |
| **Returns & Inspection**<br>`IMS/backend/controllers/returnController.js`<br>`IMS/backend/models/Return.js` | Restocks returned goods upon tracking confirmation. | `backend/src/modules/shipping/` | **REFACTOR** | Tie returns directly to original canonical order items. Add quality inspection grade (restockable vs damaged write-off). |

### 3.8 Storefront, Theming & CMS

| Existing Feature & Source Path | Current State | Target Module | Action | Technical Rationale & Refactoring Plan |
| :--- | :--- | :--- | :--- | :--- |
| **Ecommerce Storefront UI**<br>`Ecommerce/frontend/src/Pages/Home.jsx`<br>`Ecommerce/frontend/src/components/*` | High-converting, mobile-first design, banner carousels, DOD sections, SEO. | `apps/storefront/` | **REFACTOR** | Make fully dynamic based on tenant theme configuration, logo, colors, and catalog. |
| **E-Commerce CMS Controllers**<br>`Ecommerce/backend/controllers/banner.js`<br>`Ecommerce/backend/controllers/dynamicPage.js`<br>`Ecommerce/backend/controllers/popup.js` | Manages store banners, static pages, footer links, popups, and topbar text. | `backend/src/modules/tenants/` | **REFACTOR** | Scope all CMS entities to `tenantId`. Expose through seller dashboard Storefront Settings tab. |

### 3.9 Seller Consignment & Dispatch Workspace

| Existing Feature & Source Path | Current State | Target Module | Action | Technical Rationale & Refactoring Plan |
| :--- | :--- | :--- | :--- | :--- |
| **Seller Consignment & Dispatch**<br>`IMS/backend/controllers/sellerDispatchController.js`<br>`IMS/frontend/src/pages/sellers/SellerWorkspace.jsx` | 2,300 lines of consignment tracking, dual-ledger settlement, and payouts. | `backend/src/modules/wholesale/` | **REFACTOR** | Preserve this business workflow for merchants operating consignment distribution channels. |

---

## 4. Duplicate & Legacy Code Retirement Plan

The following files and components identified in the audit are marked for **immediate retirement**:
1. `Ecommerce/backend/controllers/order.js` (Lines 190–218): Hardcoded HTTP bridge to external Render URL.
2. `Ecommerce/backend/combined-saas/gateway.mjs`: Temporary reverse proxy script that maintained split databases.
3. `IMS/backend/models/Admin.js`: Merged into unified `User` model.
4. `IMS/backend/models/Sale.js`: Superseded by canonical `Order` line items with `channel: 'retail'`.
5. Duplicate LCS implementations in both repositories: Consolidated into `backend/src/modules/shipping/adapters/LcsAdapter.js`.

