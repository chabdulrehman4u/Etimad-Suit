# API Route Catalog & RBAC Permission Matrix

> **Status:** AUTHORITATIVE SPECIFICATION  
> **Target Framework:** Express / Node.js Modular Monolith  
> **Security Protocol:** Multi-Tenant Scoped RBAC + Tenant Isolation Guard  

---

## 1. Role-Based Access Control (RBAC) Definitions

Etimad Suit implements 10 distinct roles spanning Platform Administration and Tenant-Level Operations:

### Platform-Level Role
1. **`SUPER_ADMIN`**: Global SaaS platform operator. Manages all tenants, subscription tiers, platform-wide app integrations, system health, and audited tenant impersonation.

### Tenant-Level Roles
2. **`SELLER_OWNER`**: Merchant owner. Unrestricted authority over their tenant data, billing, staff, bank accounts, and custom domains.
3. **`BUSINESS_MANAGER`**: General operations manager. Full control over daily catalog, orders, POS, wholesale, and inventory. No access to plan subscription billing or company deletion.
4. **`INVENTORY_MANAGER`**: Dedicated warehouse/stock lead. Full control over purchase batches, stock adjustments, low stock alerts, and warehouse transfers.
5. **`CASHIER`**: Retail POS operator. Permitted to search products, process POS sales, record cash/card payments, and print receipts. Cannot override prices without manager approval or access financial reports.
6. **`WHOLESALE_STAFF`**: B2B account representative. Manages wholesale customers, creates quotations, applies approved wholesale tiers, and tracks customer credit/khata.
7. **`ONLINE_STORE_MANAGER`**: Digital store lead. Manages online storefront banners, CMS, coupons, blog posts, SEO, and reviews.
8. **`ACCOUNTANT`**: Financial auditor. Full access to double-entry ledger, balance sheet, profit and loss statements, bank reconciliations, and expense logs.
9. **`DISPATCH_STAFF`**: Fulfillment and logistics crew. Books courier consignments (LCS, PostEx, M&P), prints shipping labels, logs parcels, and inspects customer returns.
10. **`CUSTOMER`**: Public storefront buyer. Places online orders, tracks order progress, manages delivery addresses, and submits reviews.

---

## 2. Master Permission Matrix

| Permission Key | Description | Allowed Roles |
| :--- | :--- | :--- |
| `platform:manage` | Global tenant provisioning, SaaS billing, platform apps | `SUPER_ADMIN` |
| `tenant:billing` | Upgrade plans, view subscription invoices, manage payment method | `SELLER_OWNER` |
| `tenant:settings` | Configure branding, theme, custom domains, store profile | `SELLER_OWNER`, `BUSINESS_MANAGER` |
| `staff:manage` | Invite staff, assign roles, revoke tenant access | `SELLER_OWNER`, `BUSINESS_MANAGER` |
| `catalog:read` | View products, categories, brands, variants | All Staff & Cashiers |
| `catalog:write` | Create and edit products, upload gallery images, update prices | `SELLER_OWNER`, `BUSINESS_MANAGER`, `INVENTORY_MANAGER` |
| `inventory:read` | View stock balances, low stock alerts, stock ledger | All Staff |
| `inventory:adjust` | Execute manual stock adjustments and write-offs | `SELLER_OWNER`, `BUSINESS_MANAGER`, `INVENTORY_MANAGER` |
| `orders:read` | View orders across online, retail, and wholesale channels | All Staff |
| `orders:create_pos` | Create retail POS sales, process split payments, print bills | `CASHIER`, `BUSINESS_MANAGER`, `SELLER_OWNER` |
| `orders:manage_online` | Confirm, process, and cancel online e-commerce orders | `ONLINE_STORE_MANAGER`, `BUSINESS_MANAGER`, `SELLER_OWNER` |
| `wholesale:manage` | Manage B2B price lists, quotations, and credit limits | `WHOLESALE_STAFF`, `BUSINESS_MANAGER`, `SELLER_OWNER` |
| `purchases:manage` | Create purchase batches, receive supplier goods, compute landed cost | `INVENTORY_MANAGER`, `BUSINESS_MANAGER`, `SELLER_OWNER` |
| `shipping:book` | Book courier shipments (LCS/PostEx/M&P), print labels, dispatch | `DISPATCH_STAFF`, `BUSINESS_MANAGER`, `SELLER_OWNER` |
| `returns:inspect` | Inspect returns, record restockable vs damaged inventory | `DISPATCH_STAFF`, `INVENTORY_MANAGER`, `BUSINESS_MANAGER` |
| `finance:read` | View double-entry ledger, P&L, balance sheet, valuation | `ACCOUNTANT`, `SELLER_OWNER` |
| `finance:write` | Record expenses, add bank accounts, execute owner capital | `ACCOUNTANT`, `SELLER_OWNER` |
| `apps:configure` | Enter and test courier/payment provider credentials | `SELLER_OWNER`, `BUSINESS_MANAGER` |

---

## 3. Authoritative API Route Catalog

### 3.1 Authentication & Memberships (`/api/v1/auth`)

| Method | Endpoint | Description | Auth Required | Permissions / Guards |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/login` | Staff / Admin login, issues HTTP-only JWT | Public | RateLimit(5/min) |
| `POST` | `/register-tenant` | Self-serve merchant signup & tenant creation | Public | RateLimit(3/hr) |
| `POST` | `/logout` | Clears authentication session cookie | Yes | Authenticated |
| `GET` | `/me` | Returns authenticated user profile & tenant memberships | Yes | Authenticated |
| `POST` | `/forgot-password` | Initiates password reset email flow | Public | RateLimit(3/hr) |
| `POST` | `/reset-password` | Resets password with secure verification token | Public | SingleUseToken |
| `GET` | `/tenant/members` | Lists active staff memberships for current tenant | Yes | `staff:manage` |
| `POST` | `/tenant/members/invite`| Invites a staff member to join current tenant with role | Yes | `staff:manage` |

### 3.2 Product Catalog & Pricing (`/api/v1/products`)

| Method | Endpoint | Description | Auth Required | Permissions / Guards |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | Paginated, searchable product list for merchant | Yes | `catalog:read` |
| `POST` | `/` | Create product with multi-tier pricing and media | Yes | `catalog:write` |
| `GET` | `/:id` | Fetch product details, variants, and stock balances | Yes | `catalog:read` |
| `PUT` | `/:id` | Update product details, images, descriptions | Yes | `catalog:write` |
| `DELETE` | `/:id` | Soft-delete / archive product | Yes | `catalog:write` |
| `GET` | `/categories` | List tenant categories | Yes | `catalog:read` |
| `POST` | `/categories` | Create new tenant category | Yes | `catalog:write` |

### 3.3 Authoritative Inventory & Stock Ledger (`/api/v1/inventory`)

| Method | Endpoint | Description | Auth Required | Permissions / Guards |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/balances` | Live physical stock levels and low-stock indicators | Yes | `inventory:read` |
| `GET` | `/ledger` | Immutable audit log of stock movements (`StockLedger`) | Yes | `inventory:read` |
| `POST` | `/adjustments` | Manual stock adjustment with reason code & actor audit | Yes | `inventory:adjust` |
| `POST` | `/transfers` | Warehouse-to-warehouse stock transfer initiation | Yes | `inventory:adjust` |

### 3.4 Canonical Orders & Sales Desk (`/api/v1/orders`)

| Method | Endpoint | Description | Auth Required | Permissions / Guards |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | Omnichannel orders list (filter by `channel`, status, dates) | Yes | `orders:read` |
| `POST` | `/pos` | Fast POS sale checkout (atomic stock deduction, receipt) | Yes | `orders:create_pos` |
| `POST` | `/wholesale` | Create wholesale order or quotation | Yes | `wholesale:manage` |
| `GET` | `/:id` | Full order detail with line items, snapshots, and ledger | Yes | `orders:read` |
| `PATCH` | `/:id/status` | Advance canonical order status machine | Yes | Role-dependent |
| `POST` | `/:id/cancel` | Cancel order and automatically release reserved stock | Yes | `orders:manage_online` |

### 3.5 Purchases, Receiving & Inbound (`/api/v1/purchases`)

| Method | Endpoint | Description | Auth Required | Permissions / Guards |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/batches` | List purchase batches, supplier invoices, landed costs | Yes | `purchases:manage` |
| `POST` | `/batches` | Create purchase batch, allocate landed cost, receive stock | Yes | `purchases:manage` |
| `GET` | `/suppliers` | List suppliers and accounts payable balances | Yes | `purchases:manage` |
| `POST` | `/suppliers` | Add new supplier profile | Yes | `purchases:manage` |

### 3.6 Financial Accounting & Ledger (`/api/v1/finance`)

| Method | Endpoint | Description | Auth Required | Permissions / Guards |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/valuation` | Real-time business balance sheet and net worth | Yes | `finance:read` |
| `GET` | `/ledger` | Double-entry transaction journal | Yes | `finance:read` |
| `GET` | `/banks` | List bank accounts and live reconciled balances | Yes | `finance:read` |
| `POST` | `/banks` | Add tenant bank account | Yes | `finance:write` |
| `POST` | `/expenses` | Log operational expense with cash/bank debit | Yes | `finance:write` |

### 3.7 Shipping, Couriers & Returns (`/api/v1/shipping`)

| Method | Endpoint | Description | Auth Required | Permissions / Guards |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/book` | Book courier shipment via adapter (LCS, PostEx, M&P) | Yes | `shipping:book` |
| `GET` | `/track/:cn` | Real-time shipment status from courier adapter | Yes | `shipping:book` |
| `POST` | `/returns` | Log return from customer; restock or flag damaged | Yes | `returns:inspect` |
| `POST` | `/webhooks/:provider`| Ingest authenticated courier webhook updates | Webhook | SignatureVerified |

### 3.8 Public Storefront API (`/api/v1/storefront/:tenantSlug`)

| Method | Endpoint | Description | Auth Required | Guards |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/catalog` | Public store catalog, search, categories, banners | Public | ResolvedTenant |
| `GET` | `/products/:slug` | Public product detail, images, reviews, stock state | Public | ResolvedTenant |
| `POST` | `/orders` | Public cart checkout (server-authoritative pricing) | Public | RateLimit, ResolvedTenant |
| `GET` | `/track/:orderNo` | Customer order tracking by phone or order number | Public | ResolvedTenant |

---

## 4. Security & Isolation Enforcement Middleware

Every protected route executes through a standard middleware chain:

```javascript
// Example Express route configuration
router.post(
  '/api/v1/orders/pos',
  authenticateToken,        // 1. Validates JWT signature & expiry
  enforceTenantContext,     // 2. Extracts and verifies req.tenantId from token
  requirePermission('orders:create_pos'), // 3. RBAC permission check
  validateRequest(posOrderSchema),        // 4. Boundary payload validation (Zod)
  posOrderController.createPosSale        // 5. Authoritative controller execution
);
```
