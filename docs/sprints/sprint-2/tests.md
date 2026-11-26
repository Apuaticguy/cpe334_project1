# Software Test Specification (STS) - Sprint 2

**Project:** QuickOrder (Theme 4: E-Commerce or Ordering System)  
**Document Version:** 2.1.0 (Deliverable 2 Executed Test Mapping — Issues #37–#39)  
**Status:** Executed &amp; Verified (100% Passing)  

---

## 1. Sprint 2 Test Suite Mapping (`F-06` – `F-08`)

| Test ID | Linked AC | Feature | Test Level | Preconditions / Input | Action / Request | Expected Result | Automated Test File |
|---|---|:---:|:---:|---|---|---|---|
| **TEST-S2-01** | AC-S2-01 | F-06 | API / Int | Logged in `OPERATOR` | `POST /api/operator/catalog` with valid item (`unitPrice: 6.50`, `stockQuantity: 20`) | `201 Created`; item persisted and returned by `GET /api/catalog` | `server/tests/catalog-admin.api.test.ts` |
| **TEST-S2-02** | AC-S2-02 | F-06 | API / Int | Existing order has item snapshot at old price; Operator updates price | `PATCH /api/operator/catalog/:id` updating `unitPrice` and `stockQuantity` | `200 OK`; catalog reflects new price, historical `OrderItem.unitPriceSnapshot` unchanged | `server/tests/catalog-admin.api.test.ts` |
| **TEST-S2-03** | AC-S2-03 | F-06 | API / Int | Logged in `OPERATOR` | `POST /api/operator/catalog` with `unitPrice: -5` or `stockQuantity: -1` | `400 Bad Request` (`INVALID_INPUT`); no item created | `server/tests/catalog-admin.api.test.ts` |
| **TEST-S2-04** | AC-S2-04 | F-06 | API / Int | Logged in `CUSTOMER` (and unauth) | `POST /api/operator/catalog` and `PATCH /api/operator/catalog/1` | `403 Forbidden` for `CUSTOMER`; `401 Unauthorized` without token | `server/tests/catalog-admin.api.test.ts` |
| **TEST-S2-05** | AC-S2-05 | F-07 | API / Int | Logged in `OPERATOR`; `SUBMITTED` order (2 units deducted) | `PATCH /api/operator/orders/:id/reject` with `{ reason: "Out of cups" }` | `200 OK`; status=`REJECTED`, `rejectionReason` saved, stock atomically incremented by 2 | `server/tests/operator.api.test.ts` |
| **TEST-S2-06** | AC-S2-06 | F-07 | API / Int | Logged in `OPERATOR`; `SUBMITTED` order | `PATCH /api/operator/orders/:id/reject` with `{ reason: "   " }` or missing | `400 Bad Request` (`INVALID_INPUT`); order stays `SUBMITTED` | `server/tests/operator.api.test.ts` |
| **TEST-S2-07** | AC-S2-07 | F-07 | API / Int | Logged in `OPERATOR`; order is `ACCEPTED` or `CANCELLED` | `PATCH /api/operator/orders/:id/reject` with valid reason | `409 Conflict` (`STATE_CONFLICT`); stock unchanged | `server/tests/operator.api.test.ts` |
| **TEST-S2-08** | AC-S2-08 | F-07 | API / Int | Logged in `CUSTOMER`; `SUBMITTED` order | `PATCH /api/operator/orders/:id/reject` | `403 Forbidden`; order untouched | `server/tests/operator.api.test.ts` |
| **TEST-S2-09** | AC-S2-09, AC-S2-10 | F-08 | API / Int | Owning `CUSTOMER`; active `UNPAID` order | `POST /api/orders/:id/pay` (with tampered amount in body) | `200 OK`; `paymentStatus: 'PAID'`, non-null `paymentReference` & `paidAt` | `server/tests/payment.api.test.ts` |
| **TEST-S2-10** | AC-S2-11 | F-08 | API / Int | Order already `PAID`, or `CANCELLED`/`REJECTED` | `POST /api/orders/:id/pay` | `409 Conflict` (`ORDER_NOT_PAYABLE`) | `server/tests/payment.api.test.ts` |
| **TEST-S2-11** | AC-S2-12 | F-08 | API / Int | Non-owning `CUSTOMER` or `OPERATOR` | `POST /api/orders/:id/pay` | `403 Forbidden`; `paymentStatus` remains `UNPAID` | `server/tests/payment.api.test.ts` |
| **TEST-S2-12** | AC-S2-12 | F-08 / F-07 | API / Int | Order is `SUBMITTED` and `PAID` | Owner cancels (`PATCH /cancel`) or Operator rejects (`PATCH /reject`) | `200 OK`; `paymentStatus` atomically becomes `REFUNDED` & stock restored | `server/tests/payment.api.test.ts` |
| **TEST-S2-13** | AC-S2-01, AC-S2-05 | F-06, F-07 | UI / Vitest | Mocked operator catalog & queue APIs | Render `<OperatorDashboard />`, create item & reject order with reason | Form submits `POST /api/operator/catalog`; reject calls `PATCH /reject` & renders `REJECTED` | `client/tests/OperatorDashboard.test.tsx` |
| **TEST-S2-14** | AC-S2-10, AC-S2-05 | F-08, F-07 | UI / Vitest | Mocked customer `UNPAID` and `REJECTED` orders | Render `<OrderHistory />` and click **Pay Now** | Calls `POST /api/orders/:id/pay`, displays `PAID` receipt, and shows rejection reason | `client/tests/OrderHistory.test.tsx` |
