# Feature Engineering Contracts & Specifications - Sprint 2

**Project:** QuickOrder (Theme 4: E-Commerce or Ordering System)  
**Document Version:** 2.0.0 (Pre-Implementation Sprint 2 Contract — Issue #36)  
**Authors:** Panyakorn Lohaviboonsap (`67070503424`), Ivan Luwongsupakit (`67070503449`)  
**Status:** Pre-Implementation Draft (Pending Peer Review)  

---

## 1. Feature Engineering Contract: F-06 (Catalog & Inventory Administration)

* **Linked Requirements:** FR-10, BR-08, BR-01, FR-04  
* **Issue:** [#37](https://github.com/Apuaticguy/cpe334_project1/issues/37)  

### 1.1 Feature SDS & Workflow
Authenticated `OPERATOR` users manage the live kiosk menu from a **Manage Catalog** panel inside `OperatorDashboard.tsx`. Operators can create new catalog items and update existing items (`name`, `description`, `unitPrice`, `stockQuantity`, `isActive`). Because historical orders store `itemNameSnapshot` and `unitPriceSnapshot` in `order_items` (`FR-04`), catalog price or name edits apply exclusively to future orders and never mutate historical order totals.

### 1.2 API, Data & UI Definitions
* **Data Layer (`CatalogItem`):** Uses existing `catalog_items` table (`id`, `name`, `description`, `unitPrice`, `stockQuantity`, `isActive`, `createdAt`). **DB Migration:** None required for `F-06`.
* **`POST /api/operator/catalog`** (`requireAuth` + `requireRole('OPERATOR')`):
  * Request: `{ name: string, description: string, unitPrice: number, stockQuantity: number, isActive?: boolean }`
  * Validation & Boundaries: `name.trim().length > 0`, `description.trim().length > 0`, `unitPrice > 0` (numeric, stored as `Decimal(10, 2)`), `Number.isInteger(stockQuantity) && stockQuantity >= 0`. Invalid input &rarr; `400 Bad Request` (`INVALID_INPUT`).
  * Response: `201 Created` with created item JSON.
* **`PATCH /api/operator/catalog/:id`** (`requireAuth` + `requireRole('OPERATOR')`):
  * Request: partial `{ name?, description?, unitPrice?, stockQuantity?, isActive? }` (at least one valid field required).
  * Errors: `400 INVALID_ID` / `INVALID_INPUT`, `401 UNAUTHORIZED`, `403 FORBIDDEN` (non-operator), `404 NOT_FOUND` (missing item).
  * Response: `200 OK` with updated item JSON.
* **Frontend UI (`OperatorDashboard.tsx`):** Tab/section allowing operators to add new items via form, edit inline stock/price, and toggle `Active` / `Inactive` visibility. Inactive items do not appear in public `GET /api/catalog`.

### 1.3 Acceptance Criteria (F-06)
* **AC-S2-01:** Given an authenticated `OPERATOR`, `POST /api/operator/catalog` with valid item details (`unitPrice > 0`, `stockQuantity >= 0`) creates the item (`201 Created`) and exposes active items in `GET /api/catalog`.
* **AC-S2-02:** Given an authenticated `OPERATOR`, `PATCH /api/operator/catalog/:id` updates price, stock, or `isActive` (`200 OK`) without altering `OrderItem.unitPriceSnapshot` on existing historical orders.
* **AC-S2-03:** Given `unitPrice <= 0`, `stockQuantity < 0`, non-integer stock, or empty name, `POST`/`PATCH` rejects with `400 Bad Request` and persists no changes.
* **AC-S2-04:** Given an authenticated `CUSTOMER` or unauthenticated user calling `POST`/`PATCH /api/operator/catalog*`, the server rejects with `403 Forbidden` / `401 Unauthorized`.

---

## 2. Feature Engineering Contract: F-07 (Order Cancellation & Rejection Workflow)

* **Linked Requirements:** FR-09 (Lab 7), FR-11, BR-07 (Lab 7), BR-09, BR-06  
* **Issues:** [#30](https://github.com/Apuaticguy/cpe334_project1/issues/30) / [#32](https://github.com/Apuaticguy/cpe334_project1/issues/32) (Customer Cancel, complete) + [#38](https://github.com/Apuaticguy/cpe334_project1/issues/38) (Operator Reject)  

### 2.1 Feature SDS & Workflow
Extends the Sprint 1 order lifecycle (`SUBMITTED -> ACCEPTED`) and Lab 7's customer cancellation (`SUBMITTED -> CANCELLED`, `PATCH /api/orders/:id/cancel`) by allowing an `OPERATOR` to **reject** a pending `SUBMITTED` order with a mandatory explanation (`SUBMITTED -> REJECTED`). Like customer cancellation, operator rejection atomically restores ordered `stockQuantity` back to `catalog_items` and marks any `PAID` order as `REFUNDED`.

### 2.2 API, Data & UI Definitions
* **Data Layer (`prisma/schema.prisma`):**
  * Extend `OrderStatus` enum with `REJECTED`.
  * Add `rejectionReason String?` to `Order`.
* **`PATCH /api/orders/:id/cancel`** *(Delivered in Lab 7, enhanced for `F-08` refund consistency)*: Owning `CUSTOMER` cancels `SUBMITTED` order &rarr; `CANCELLED`, restores stock, and sets `paymentStatus = REFUNDED` if previously `PAID`.
* **`PATCH /api/operator/orders/:id/reject`** (`requireAuth` + `requireRole('OPERATOR')`):
  * Request: `{ reason: string }`
  * Validation & Boundaries: `reason.trim().length > 0` (blank/missing &rarr; `400 INVALID_INPUT`). Order must currently be in `SUBMITTED` status (else `409 STATE_CONFLICT`).
  * Atomic `$transaction`: Conditional `updateMany` where `{ id, status: 'SUBMITTED' }` sets `status = 'REJECTED'`, `rejectionReason = reason.trim()`, `paymentStatus = order.paymentStatus === 'PAID' ? 'REFUNDED' : order.paymentStatus`, and increments `catalogItem.stockQuantity` by `item.quantity`.
  * Errors: `400`, `401`, `403 FORBIDDEN` (for `CUSTOMER`), `404 NOT_FOUND`, `409 STATE_CONFLICT`.
* **Frontend UI:**
  * `OperatorDashboard.tsx`: Adds **Reject** action with reason input modal/inline field for `SUBMITTED` orders; displays `REJECTED` badge and reason.
  * `OrderHistory.tsx`: Displays `REJECTED` badge and the recorded `rejectionReason` clearly to the customer.

### 2.3 Acceptance Criteria (F-07)
* **AC-S2-05:** Given an authenticated `OPERATOR` and a `SUBMITTED` order, `PATCH /api/operator/orders/:id/reject` with a non-empty `reason` transitions status to `REJECTED` (`200 OK`), stores `rejectionReason`, restores `catalog_items.stockQuantity` atomically, and refunds `PAID` orders to `REFUNDED`.
* **AC-S2-06:** Given a missing or whitespace-only `reason`, `PATCH /api/operator/orders/:id/reject` rejects with `400 Bad Request` and leaves order status and stock unchanged.
* **AC-S2-07:** Given an order already `ACCEPTED`, `CANCELLED`, or `REJECTED`, attempting rejection returns `409 Conflict` (`STATE_CONFLICT`) with zero stock mutation.
* **AC-S2-08:** Given a `CUSTOMER` attempting `PATCH /api/operator/orders/:id/reject`, the server rejects with `403 Forbidden`. *(Preserved `AC-14`–`AC-16` cover customer cancellation.)*

---

## 3. Feature Engineering Contract: F-08 (Simulated Payment Processing)

* **Linked Requirements:** FR-12, BR-10, BR-01, BR-04  
* **Issue:** [#39](https://github.com/Apuaticguy/cpe334_project1/issues/39)  

### 3.1 Feature SDS & Workflow
Integrates an authoritative simulated payment lifecycle (`UNPAID -> PAID -> REFUNDED`) onto every order without external payment gateway dependencies. Orders start as `UNPAID` at creation (`POST /api/orders`). The owning `CUSTOMER` initiates simulated checkout via `POST /api/orders/:id/pay`, generating a deterministic-format transaction reference (`PAY-<orderId>-<timestamp>`) and recording `paidAt`. If a `PAID` order is subsequently cancelled (`F-07`) or rejected (`F-07`), the transaction atomically updates `paymentStatus` to `REFUNDED`.

### 3.2 API, Data & UI Definitions
* **Data Layer (`prisma/schema.prisma`):**
  * Add `enum PaymentStatus { UNPAID PAID REFUNDED }`.
  * Add to `Order`: `paymentStatus PaymentStatus @default(UNPAID)`, `paymentReference String?`, `paidAt DateTime?`.
* **`POST /api/orders/:id/pay`** (`requireAuth`):
  * Role & Ownership: Must be `CUSTOMER` and `order.userId === req.user.id` (non-owner or `OPERATOR` &rarr; `403 FORBIDDEN`).
  * State Boundary: `order.paymentStatus === 'UNPAID'` AND `order.status` is NOT `CANCELLED` or `REJECTED` (otherwise &rarr; `409 Conflict`, code `ORDER_NOT_PAYABLE`).
  * Amount: Server ignores any client-submitted `amount` and records payment against authoritative `order.totalAmount`.
  * Response: `200 OK` returning updated order with `paymentStatus: 'PAID'`, `paymentReference`, and `paidAt`.
* **Frontend UI:**
  * `OrderHistory.tsx`: Displays `UNPAID` / `PAID` / `REFUNDED` badge, **Pay Now** button for payable `UNPAID` orders, and receipt details (`paymentReference`, `paidAt`, authoritative total).
  * `OperatorDashboard.tsx`: Displays `paymentStatus` badge in the operator order table so kitchen staff see payment confirmation.

### 3.3 Acceptance Criteria (F-08)
* **AC-S2-09:** Given a newly placed order, `paymentStatus` initializes to `UNPAID` (`paymentReference: null`, `paidAt: null`).
* **AC-S2-10:** Given an owning `CUSTOMER` and an active `UNPAID` order (`SUBMITTED` or `ACCEPTED`), `POST /api/orders/:id/pay` returns `200 OK`, transitions `paymentStatus` to `PAID`, sets `paidAt` and `paymentReference`, and ignores any client-supplied amount.
* **AC-S2-11:** Given an already `PAID`, `REFUNDED`, `CANCELLED`, or `REJECTED` order, `POST /api/orders/:id/pay` rejects with `409 Conflict` (`ORDER_NOT_PAYABLE`).
* **AC-S2-12:** Given a non-owning `CUSTOMER` or `OPERATOR` calling `POST /api/orders/:id/pay`, the server rejects with `403 Forbidden`; cancelling or rejecting a `PAID` order transitions `paymentStatus` atomically to `REFUNDED`.

---

## 4. Sprint 2 Definition of Done (DoD)
1. Pre-implementation contracts (`specifications.md`, `tests.md`) reviewed and merged to `staging` before feature coding.
2. Each Issue (`#37`, `#38`, `#39`) has RED &rarr; GREEN TDD automated tests covering normal paths, boundaries (`400`/`409`/`422`), and role/ownership isolation (`401`/`403`).
3. Additive Prisma schema migration succeeds idempotently against PostgreSQL.
4. Peer-reviewed PRs merged into `staging`, CI passes 100%, and existing Sprint 1 tests remain green without regressions.
