# Lab 7 Part A: Change Request & Impact Analysis (Issue #30)

**Project:** QuickOrder (Theme 4 — E-Commerce / Pre-Order Platform)  
**Change Request Issue:** [#30](https://github.com/Apuaticguy/cpe334_project1/issues/30)  
**Accepted Sprint 1 Baseline:** `aa632f65b254c5b1b4346a008943a1f192ce8b6b` (Release B)  
**Pre-Change Deployed Version:** `8d400ada0a887fe48c908c6dfd6dbda44b82d338` (Release B-Fix, Cloud Run `https://quickorder-wcdixtgbxq-as.a.run.app`)  

---

## 1. Old vs. New Behavior Summary

* **Original Sprint 1 Rule (`FR-05`, `BR-06`, Feature F-04):** Once a customer submits an order (`SUBMITTED`), it cannot be cancelled by the customer. Only Operators can transition orders (`SUBMITTED -> ACCEPTED`), and `OrderStatus.CANCELLED` in `prisma/schema.prisma` is unused.
* **Approved New Rule (`FR-09`, `BR-07`, `AC-14`–`AC-16`):**
  * Owning `CUSTOMER` (`order.userId === req.user.id`) may cancel a `SUBMITTED` order via `PATCH /api/orders/:id/cancel`, transitioning status to `CANCELLED`.
  * Cancellation executes atomically inside `prisma.$transaction`, incrementing `catalog_items.stockQuantity` for every `OrderItem`.
  * **Boundary & Invalid Cases:** `ACCEPTED` or `CANCELLED` orders reject cancellation with `409 Conflict` (`ORDER_NOT_CANCELLABLE`); non-owning customers or `OPERATOR` accounts reject with `403 Forbidden`; unauthenticated requests reject with `401 Unauthorized`; unknown IDs return `404 Not Found`.

---

## 2. Compact Impact Analysis Table

| Impact Dimension | Affected Artifacts / IDs | Analysis & Required Change |
|---|---|---|
| **Requirements & SRS** | `FR-05`, `FR-09` (new), `BR-06`, `BR-07` (new) (`docs/srs.md` §2, §4, §5) | Added `FR-09` and `BR-07` defining customer cancellation, `409` state boundary, and atomic stock restoration; updated Customer actor permissions. |
| **Feature Spec & ACs** | Feature F-04 (`docs/sprints/sprint-1/specifications.md` §3), `AC-14`, `AC-15`, `AC-16` | Added `PATCH /api/orders/:id/cancel` contract and `AC-14`–`AC-16`. |
| **Software Test Spec (STS)** | `docs/sprints/sprint-1/tests.md` v1.1.0 (`TEST-16` to `TEST-19`) | Added 3 API integration tests (`order-history.api.test.ts`) and 1 UI component test (`OrderHistory.test.tsx`). |
| **Backend API & Callers** | `server/src/routes/orders.ts` | Add `PATCH /api/orders/:id/cancel` with `requireAuth`, `CUSTOMER` role check, ownership check, `SUBMITTED` state check, and atomic `$transaction` stock restoration. |
| **Operator Queue Caller** | `server/src/routes/operator.ts` | Existing `PATCH /api/operator/orders/:id/accept` already rejects non-`SUBMITTED` orders (including `CANCELLED`) with `409 Conflict` (`BR-06`). Verify via regression. |
| **Frontend UI & Validation** | `client/src/components/OrderHistory.tsx`, `client/src/components/OperatorDashboard.tsx` | Add "Cancel Order" button only on `SUBMITTED` orders in `OrderHistory.tsx` with `CANCELLED` badge and error banner; add `CANCELLED` badge styling in `OperatorDashboard.tsx`. |
| **Roles & Ownership** | `CUSTOMER` vs `OPERATOR` (`requireAuth`) | Enforces `req.user.role === 'CUSTOMER'` and `order.userId === req.user.id`; all others receive `403 Forbidden`. |
| **Persistence & Historical Data** | PostgreSQL `orders`, `catalog_items`, `order_items` | `orders.status` updates to `CANCELLED`; `catalog_items.stockQuantity` increments by `OrderItem.quantity`; historical `OrderItem.unitPriceSnapshot` remains immutable. |
| **Database Migrations** | `server/prisma/schema.prisma` | **Not Applicable (N/A):** `OrderStatus.CANCELLED` already exists in `schema.prisma` enum (lines 15–19); zero schema migrations required. |

---

## 3. Preserved Behavior & Regression Protection

* **Preserved Sprint 1 Behaviors:**
  1. Authoritative order creation, pricing, and stock deduction (`POST /api/orders`, `AC-06`–`AC-08`).
  2. Cross-customer order read isolation (`GET /api/orders/:id`, `AC-10`).
  3. Operator order queue and atomic `SUBMITTED -> ACCEPTED` transition (`AC-11`–`AC-13`), including rejecting `accept` on `CANCELLED` orders (`BR-06`).
  4. Cart stock boundary cap (`DEF-QO-01` / Issue #27).
* **Regression Suites:** `server/tests/*.test.ts` (28 existing tests) and `client/tests/*.test.tsx` (9 existing tests) will all be executed unchanged alongside `TEST-16`–`TEST-19`.
