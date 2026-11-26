# Feature Engineering Contracts & Specifications - Sprint 3

**Project:** QuickOrder (Theme 4: E-Commerce or Ordering System)  
**Document Version:** 3.0.0 (Sprint 3 Contracts & Working Increment Target — Issue #36)  
**Authors:** Panyakorn Lohaviboonsap (`67070503424`), Ivan Luwongsupakit (`67070503449`)  
**Status:** Deliverable 2 Contract (`F-09` Scheduled for D2 Implementation; `F-10` & `F-11` Planned for Final Delivery by 13 Dec)  

---

## 1. Feature Engineering Contract: F-09 (Order Fulfillment & Ready-for-Pickup Lifecycle)

* **Linked Requirements:** FR-13, BR-11, BR-05, BR-06  
* **Issue:** [#40](https://github.com/Apuaticguy/cpe334_project1/issues/40) *(Implemented in Deliverable 2)*  

### 1.1 Feature SDS & Workflow
Extends the operator fulfillment workflow beyond `ACCEPTED` into physical pickup completion: `ACCEPTED -> READY_FOR_PICKUP -> COMPLETED`. Each step records an authoritative server timestamp (`readyAt`, `completedAt`), visible in both `OperatorDashboard.tsx` and the customer's `OrderHistory.tsx`.

### 1.2 API, Data & UI Definitions
* **Data Layer (`prisma/schema.prisma`):**
  * Extend `OrderStatus` enum with `READY_FOR_PICKUP` and `COMPLETED`.
  * Add `readyAt DateTime?` and `completedAt DateTime?` to `Order`.
* **`PATCH /api/operator/orders/:id/ready`** (`requireAuth` + `requireRole('OPERATOR')`):
  * Precondition: Order status MUST equal `ACCEPTED` (any other status &rarr; `409 Conflict`, code `STATE_CONFLICT`).
  * Action: Atomically sets `status = READY_FOR_PICKUP` and `readyAt = now()`. Returns `200 OK`.
* **`PATCH /api/operator/orders/:id/complete`** (`requireAuth` + `requireRole('OPERATOR')`):
  * Precondition: Order status MUST equal `READY_FOR_PICKUP` (skipping directly from `SUBMITTED` or `ACCEPTED` &rarr; `409 Conflict`, code `STATE_CONFLICT`).
  * Action: Atomically sets `status = COMPLETED` and `completedAt = now()`. Returns `200 OK`.
* **Permissions & Errors:** `CUSTOMER` callers &rarr; `403 FORBIDDEN`; unauthenticated &rarr; `401 UNAUTHORIZED`; unknown ID &rarr; `404 NOT_FOUND`.
* **Frontend UI:** `OperatorDashboard.tsx` renders **Mark Ready** (`ACCEPTED`) and **Complete Order** (`READY_FOR_PICKUP`) action buttons; `OrderHistory.tsx` displays `READY_FOR_PICKUP` / `COMPLETED` badges and timestamps.

### 1.3 Acceptance Criteria (F-09)
* **AC-S3-01:** Given an `ACCEPTED` order, an `OPERATOR` calling `PATCH /api/operator/orders/:id/ready` transitions status to `READY_FOR_PICKUP` (`200 OK`) and records `readyAt`.
* **AC-S3-02:** Given a `READY_FOR_PICKUP` order, an `OPERATOR` calling `PATCH /api/operator/orders/:id/complete` transitions status to `COMPLETED` (`200 OK`) and records `completedAt`.
* **AC-S3-03:** Given an order not in the required prior state (e.g., `SUBMITTED` or `CANCELLED`), calling `/ready` or `/complete` rejects with `409 Conflict`; `CUSTOMER` callers receive `403 Forbidden`.

---

## 2. Feature Engineering Contract: F-10 (Sales Analytics & Reporting Dashboard)

* **Linked Requirements:** FR-14, BR-12, BR-05  
* **Target Completion:** Final Delivery (13 December 2026)  

### 2.1 Feature SDS & Workflow
Provides an `OPERATOR`-only operational reporting dashboard summarizing realized revenue, order counts by status, average order value, and top-selling catalog items from persisted PostgreSQL `orders` and `order_items` snapshots.

### 2.2 API, Data & UI Definitions
* **Data Layer:** Uses existing `orders` (`totalAmount`, `status`, `paymentStatus`, `createdAt`) and `order_items` (`itemNameSnapshot`, `quantity`, `lineTotal`); **no DB migration needed.**
* **`GET /api/operator/analytics?from=&to=`** (`requireAuth` + `requireRole('OPERATOR')`):
  * Revenue & Volume Calculation: Aggregates authoritative `totalAmount` exclusively from orders where `status NOT IN ('CANCELLED', 'REJECTED')` and `paymentStatus != 'REFUNDED'`.
  * Response: `{ totalRevenue: string, totalOrders: number, fulfilledOrders: number, averageOrderValue: string, topItems: Array<{ catalogItemId: number, itemName: string, totalQuantity: number, totalRevenue: string }> }`.
  * Permissions & Boundaries: Invalid date query (`from > to` or malformed date) &rarr; `400 INVALID_INPUT`; `CUSTOMER` &rarr; `403 FORBIDDEN`; unauthenticated &rarr; `401 UNAUTHORIZED`.
* **Frontend UI:** **Analytics** tab in `OperatorDashboard.tsx` showing KPI summary cards and a ranked top-items table.

### 2.3 Acceptance Criteria (F-10)
* **AC-S3-04:** Given an authenticated `OPERATOR`, `GET /api/operator/analytics` computes accurate revenue and item totals excluding `CANCELLED` and `REJECTED` orders.
* **AC-S3-05:** Given invalid date range parameters (`from > to`), the endpoint returns `400 Bad Request`.
* **AC-S3-06:** Given a `CUSTOMER` or unauthenticated caller calling `GET /api/operator/analytics`, the server rejects with `403 Forbidden` / `401 Unauthorized`.

---

## 3. Feature Engineering Contract: F-11 (Customer Favorite Orders & Quick Re-Order)

* **Linked Requirements:** FR-15, BR-13, BR-03, BR-04  
* **Target Completion:** Final Delivery (13 December 2026)  

### 3.1 Feature SDS & Workflow
Allows owning `CUSTOMER` users to toggle orders as favorites in `OrderHistory.tsx` and trigger a one-click **Re-Order** action that submits a fresh order (or populates the cart) using the **current authoritative catalog price and stock** (`FR-03` — never reusing stale historical prices if catalog prices changed).

### 3.2 API, Data & UI Definitions
* **Data Layer (`prisma/schema.prisma`):** Add `isFavorite Boolean @default(false)` on `Order` (optional schema enhancement prior to `F-11` implementation).
* **`PATCH /api/orders/:id/favorite`** (`requireAuth`, owner `CUSTOMER` only): Toggles or sets `{ isFavorite: boolean }`. Non-owner / `OPERATOR` &rarr; `403 FORBIDDEN`.
* **`POST /api/orders/:id/reorder`** (`requireAuth`, owner `CUSTOMER` only): Fetches original `OrderItem` quantities, verifies active status & live stock via `F-03` rules (`422` if any item is now inactive or out of stock), computes fresh authoritative prices, creates a new `SUBMITTED` / `UNPAID` order, and deducts stock inside `$transaction`.
* **Frontend UI:** Favorite star toggle and **Re-Order** button per order card in `OrderHistory.tsx`, surfacing stock warnings cleanly.

### 3.3 Acceptance Criteria (F-11)
* **AC-S3-07:** Given an owning `CUSTOMER`, `PATCH /api/orders/:id/favorite` persists `isFavorite` (`200 OK`); non-owners receive `403 Forbidden`.
* **AC-S3-08:** Given all items in a past order are active with sufficient live stock, `POST /api/orders/:id/reorder` creates a new order (`201 Created`) billed at **current** catalog prices (`OrderItem.unitPriceSnapshot` updated to live price).
* **AC-S3-09:** Given any item in the past order is inactive or out of stock, `POST /api/orders/:id/reorder` rejects with `422 Unprocessable Entity` and persists no order.
