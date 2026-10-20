# Etimad Suit — Implementation & Working-Product Verification Status

**Document Created:** October 20, 2026  
**Repository:** [https://github.com/chabdulrehman4u/Etimad-Suit](https://github.com/chabdulrehman4u/Etimad-Suit)  
**Verification Suite Status:** 14 Test Suites, 83 Tests Passed (100% Pass Rate)  
**Production Build Status:** Passed (Vite bundles compiled across all workspaces)

---

## 1. Working Features Verified by Automated Tests

Every feature listed below has been executed and proven in automated integration and unit test suites:

| Domain | Tested Feature | Verification Test Suite |
| :--- | :--- | :--- |
| **Multi-Tenancy** | Strict tenant scoping on all models; foreign-key isolation; complete prevention of cross-tenant query leaks | `tests/integration/tenant-isolation.test.js`, `tests/integration/end-to-end-lifecycle.test.js` |
| **Authentication & RBAC** | JWT signing/verification, 10 distinct RBAC roles, permission bitmasks, account status guards | `tests/unit/rbac-middleware.test.js`, `tests/unit/roles.test.js` |
| **Catalog & Products** | Product CRUD, scoped unique slugs and barcodes, category filtering, multi-channel availability flags | `tests/integration/end-to-end-lifecycle.test.js` |
| **Inventory Integrity** | Conditional atomic decrements (`$inc: -qty`, `$gte: qty`), compensating rollbacks on partial batch failure | `tests/integration/stock-concurrency.test.js` |
| **Race Conditions** | 50 concurrent parallel checkout requests; exact stock preservation with zero negative balances | `tests/integration/stock-concurrency.test.js` |
| **Authoritative Pricing** | Server-side totals, volume quantity tiers, Pakistani shipping rules, coupon validation | `tests/integration/pricing.test.js` |
| **Canonical Orders** | Single unified order pipeline across Online, Retail POS, and Wholesale channels | `tests/integration/canonical-orders.test.js` |
| **Order Cancellation** | Automatic stock restoration (`STOCK_RELEASE`) in `StockLedger` upon cancellation | `tests/integration/end-to-end-lifecycle.test.js` |
| **Retail Point-of-Sale** | Fast barcode scanner lookup, shift open/close cash drawer floats, split payments (`cash` + `card`) | `tests/integration/pos-and-wholesale.test.js` |
| **Wholesale B2B** | Wholesale customer khata, quotations, credit limit enforcement, bulk order conversion | `tests/integration/pos-and-wholesale.test.js` |
| **Purchasing & Landed Cost**| Batch receipts, supplier payables, freight landed cost pro-rating across unit costs | `tests/integration/purchases-finance-logistics.test.js` |
| **Double-Entry Finance** | Real-time Balance Sheet enforcing $\text{Assets} = \text{Liabilities} + \text{Equity}$, Profit & Loss statements | `tests/integration/purchases-finance-logistics.test.js`, `tests/integration/end-to-end-lifecycle.test.js` |
| **Courier Integrations** | AES-256-GCM encrypted credentials, Leopards (LCS) and PostEx adapters, outage fallbacks | `tests/integration/apps-and-couriers.test.js` |
| **SaaS Subscriptions** | Plan tier quotas (products, staff seats), entitlement enforcement middleware (`requireEntitlement`) | `tests/integration/subscriptions-and-admin.test.js` |
| **Platform Administration** | Super-admin RBAC guard (`requirePlatformAdmin`), cross-tenant metrics, merchant suspension | `tests/integration/subscriptions-and-admin.test.js`, `tests/integration/end-to-end-lifecycle.test.js` |
| **Dynamic Storefront CMS** | Live CSS color variables, draft vs published homepage section builder, dynamic footer builder | `tests/integration/dynamic-storefront.test.js` |
| **Staged Data Migration** | 6-stage migration from legacy E-com & IMS with zero orphan foreign keys and password hash preservation | `tests/integration/staged-migration.test.js` |

---

## 2. Incomplete or Demo-Only Features

1. **Backend Cloud Deployment**:
   - The frontend applications are deployed to Vercel (`https://etimad-suit.vercel.app`, `https://etimad-suit-mwjr.vercel.app`, `https://etimad-suit-platform-admin.vercel.app`).
   - **The backend API is NOT yet deployed to a public cloud URL**. It currently runs in development mode locally (`http://localhost:5000`).
   - The frontends connect to the local backend during development via Vite proxy, or will connect to a deployed backend URL once configured via `VITE_API_URL`.
2. **Explicit Offline Sandbox Mode**:
   - To enable offline testing and UI review without a running database, an **explicitly labeled demo sandbox** is provided.
   - It is clearly separated from real authentication: it sets an explicit `isDemo` flag, uses distinct sandbox tokens (`demo_sandbox_*`), and displays a persistent yellow warning banner:
     `⚠️ OFFLINE DEMO SANDBOX — Changes are simulated locally and are not saved to the production backend.`
   - Normal operating mode now requires genuine backend authentication and displays clear loading, empty, and connection error states.
3. **Production Courier Credentials**:
   - Third-party courier integrations (LCS, PostEx) are currently verified in sandbox/mock mode. Production API credentials must be entered per tenant through the Apps tab once real merchant accounts are provisioned.

---

## 3. Bugs Found and Fixes Made

| # | Severity | Defect Identified | Architectural Fix Applied |
| :--- | :--- | :--- | :--- |
| **1** | **High** | **Silent Demo Authentication Fallback**: When backend was offline, submitting login/register forms silently logged the user in as a demo user, masking backend failures. | **Removed silent fallback**. Real login attempts now contact the backend API and display real connection errors. Sandbox mode is now an explicit, separate opt-in button with a persistent banner. |
| **2** | **High** | **Silent Storefront Dummy Fallback**: When backend was offline, storefront silently injected dummy products, concealing API connectivity failures. | **Replaced with explicit error/empty states**. Storefront displays an informative connection error with a "Retry Connection" button, or an empty state when catalog has no products. |
| **3** | **High** | **Vercel SPA Rewrite Swallowing `/api/*`**: `vercel.json` rewrote `/(.*)` to `/index.html`, returning HTML on API requests and causing JSON parse crashes. | **Updated rewrite regex** to `/((?!api/).*)` to exclude API routes from SPA rewrites. |
| **4** | **Medium** | **Permissive CORS Fallback**: `backend/src/app.js` fell through to `callback(null, true)` in dev mode. | **Strict CORS enforcement**: Configured `config.allowedOrigins` including all three Vercel URLs, localhost, and `ALLOWED_ORIGINS` env var, rejecting unapproved origins. |
| **5** | **Medium** | **Order Status Parameter Mismatch**: `orderController.updateStatus` only parsed `req.body.fulfillmentStatus` and ignored `req.body.status`. | **Normalized status parameter**: Updated controller to accept both `fulfillmentStatus` and `status`, properly triggering stock restoration upon cancellation. |
| **6** | **Low** | **API Base URL Resolution in Frontends**: API calls were hardcoded to relative paths `/api/...`. | **Added `getApiBaseUrl()` utility** in `@etimad/ui` that supports `VITE_API_URL` or `VITE_API_BASE_URL` environment variables. |

---

## 4. Test and Build Commands with Actual Results

All commands were executed in the repository root (`C:\Users\ETIMAD MART\Etimad-Suit`):

### Dependency Installation
```bash
npm install
```
- **Exit Code**: `0` (Success)
- **Output**: `up to date, audited 357 packages in 5s`

### Backend Automated Test Suite
```bash
npm test
```
- **Exit Code**: `0` (Success)
- **Duration**: `15.02s`
- **Result**: **14 test files passed, 83 tests passed (100% pass rate)**

```text
 ✓ tests/integration/purchases-finance-logistics.test.js  (5 tests)
 ✓ tests/integration/pos-and-wholesale.test.js           (6 tests)
 ✓ tests/integration/dynamic-storefront.test.js           (6 tests)
 ✓ tests/integration/apps-and-couriers.test.js           (6 tests)
 ✓ tests/integration/end-to-end-lifecycle.test.js        (4 tests)
 ✓ tests/integration/tenant-isolation.test.js           (9 tests)
 ✓ tests/unit/tenant-middleware.test.js                  (5 tests)
 ✓ tests/unit/roles.test.js                              (9 tests)
 ✓ tests/unit/rbac-middleware.test.js                    (5 tests)
 ✓ tests/integration/staged-migration.test.js           (2 tests)
 ✓ tests/integration/subscriptions-and-admin.test.js     (6 tests)
 ✓ tests/integration/stock-concurrency.test.js           (5 tests)
 ✓ tests/integration/canonical-orders.test.js           (4 tests)
 ✓ tests/integration/pricing.test.js                    (11 tests)

 Test Files  14 passed (14)
      Tests  83 passed (83)
```

### Production Build Across Workspaces
```bash
npm run build
```
- **Exit Code**: `0` (Success)
- **Results**:
  - `@etimad/platform-admin`: `dist/assets/index-CxoKBQz3.js (159.40 kB)` built in `1.42s`.
  - `@etimad/seller-dashboard`: `dist/assets/index-BUbJyVvW.js (209.42 kB)` built in `1.60s`.
  - `@etimad/storefront`: `dist/assets/index-D1i0i2d2.js (180.63 kB)` built in `1.29s`.

---

## 5. Backend Deployment URL & API Routing Configuration

- **Current Status**: The backend is **NOT yet deployed to a public cloud host**.
- **Local Dev URL**: `http://localhost:5000` (Health check: `http://localhost:5000/health`).
- **Frontend Vercel Deployments**:
  - Storefront: [https://etimad-suit.vercel.app](https://etimad-suit.vercel.app)
  - Seller Dashboard: [https://etimad-suit-mwjr.vercel.app](https://etimad-suit-mwjr.vercel.app)
  - Platform Admin: [https://etimad-suit-platform-admin.vercel.app](https://etimad-suit-platform-admin.vercel.app)
- **API Routing Strategy**:
  - All frontend apps resolve the API URL via `getApiBaseUrl()` from `@etimad/ui`.
  - When `VITE_API_URL` is set in Vercel environment variables, requests point directly to the deployed backend with CORS credentials enabled.
  - In local development, requests default to `/api/v1/...` and are proxied to `http://localhost:5000` by Vite.

---

## 6. Environment Variables and Deployment Steps Required

### Backend Environment Variables (`backend/.env` or Cloud Host Settings):
```env
NODE_ENV=production
PORT=5000
HOST=0.0.0.0
APP_NAME="Etimad Suit"
PLATFORM_DOMAIN=etimadsuit.com

# Standalone MongoDB Connection (MongoDB Atlas or Cloud Mongo)
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/etimad_suit_prod?retryWrites=true&w=majority

# Security Keys
JWT_SECRET=<secure_random_64_character_hex_string>
JWT_EXPIRES_IN=7d
COOKIE_SECRET=<secure_random_string>
DATA_ENCRYPTION_KEY=<32_byte_hex_key_for_encrypting_tenant_api_secrets>

# Allowed CORS Origins
ALLOWED_ORIGINS=https://etimad-suit.vercel.app,https://etimad-suit-mwjr.vercel.app,https://etimad-suit-platform-admin.vercel.app
```

### Frontend Environment Variables (Vercel Project Settings for all 3 apps):
```env
VITE_API_URL=https://<your-backend-service-url>
```

### Backend Deployment Steps (e.g. Render, Railway, or VPS):
1. Create a MongoDB Atlas cluster and obtain the production connection URI.
2. Connect repository `chabdulrehman4u/Etimad-Suit` on Render or Railway.
3. Configure service root to `backend/`.
4. Set build command: `npm install`.
5. Set start command: `node src/server.js`.
6. Add the environment variables above.
7. Deploy service and copy the public URL (e.g. `https://etimad-backend.onrender.com`).
8. Add `VITE_API_URL=https://etimad-backend.onrender.com` to the 3 Vercel frontend projects.

---

## 7. Remaining Blockers (Ranked by Priority)

1. **Priority 1 (Critical)**: **Host the Authoritative Backend & Database**.
   The frontends on Vercel are ready and waiting for an active backend. Deploying `backend/` to Render, Railway, or a VPS with MongoDB Atlas will activate live authentication, order placement, and inventory synchronization across the live web.
2. **Priority 2 (High)**: **Configure `VITE_API_URL` on Vercel Projects**.
   Once the backend URL is live, add `VITE_API_URL=<backend_url>` in the Vercel dashboard for the three projects and trigger a redeploy.
3. **Priority 3 (Medium)**: **Configure Merchant Custom Domains**.
   Set up wildcard DNS CNAME records (`*.etimadsuit.com`) pointing to the Vercel Storefront deployment to support automatic merchant subdomain provisioning.

---

## 8. Exact Next Action Required from You

1. **Provide or Select Backend Hosting Target**:
   Choose where you would like the authoritative backend to run:
   - **Render** (Recommended for easiest GitHub auto-deploy)
   - **Railway**
   - **Ubuntu VPS / DigitalOcean / AWS** (via Docker or PM2)
2. **MongoDB Connection**:
   Provide a MongoDB Atlas connection string (or set it up on your cloud provider) for the development/production database.

