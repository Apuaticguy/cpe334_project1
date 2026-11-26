# Software Test Specification (STS) - Sprint 3

**Project:** QuickOrder (Theme 4: E-Commerce or Ordering System)  
**Document Version:** 3.0.0 (Sprint 3 Test Plan — `F-09` Targeted in D2; `F-10`/`F-11` Planned for Final Delivery)  
**Status:** Pre-Implementation Test Specification  

---

## 1. Sprint 3 Test Suite Mapping (`F-09` – `F-11`)

| Test ID | Linked AC | Feature | Test Level | Preconditions / Input | Action / Request | Expected Result | Automated Test File | D2 Status |
|---|---|:---:|:---:|---|---|---|---|---|
| **TEST-S3-01** | AC-S3-01 | F-09 | API / Int | Logged in `OPERATOR`; Order is `ACCEPTED` | `PATCH /api/operator/orders/:id/ready` | `200 OK`; `status = READY_FOR_PICKUP`, non-null `readyAt` | `server/tests/operator.api.test.ts` | Target in D2 (#40) |
| **TEST-S3-02** | AC-S3-02 | F-09 | API / Int | Logged in `OPERATOR`; Order is `READY_FOR_PICKUP` | `PATCH /api/operator/orders/:id/complete` | `200 OK`; `status = COMPLETED`, non-null `completedAt` | `server/tests/operator.api.test.ts` | Target in D2 (#40) |
| **TEST-S3-03** | AC-S3-03 | F-09 | API / Int | Order is `SUBMITTED` (or caller is `CUSTOMER`) | `PATCH /ready` or `PATCH /complete` | `409 Conflict` for skipped state; `403 Forbidden` for `CUSTOMER` | `server/tests/operator.api.test.ts` | Target in D2 (#40) |
| **TEST-S3-04** | AC-S3-01, AC-S3-02 | F-09 | UI / Vitest | Mocked `ACCEPTED` and `READY_FOR_PICKUP` orders | Render `<OperatorDashboard />` and click **Mark Ready** / **Complete Order** | Calls `/ready` and `/complete`; status badges update accurately | `client/tests/OperatorDashboard.test.tsx` | Target in D2 (#40) |
| **TEST-S3-05** | AC-S3-04 | F-10 | API / Int | DB has `COMPLETED`, `PAID`, and `CANCELLED` orders | `GET /api/operator/analytics` as `OPERATOR` | `200 OK`; revenue excludes `CANCELLED`/`REJECTED` orders; accurate top items | `server/tests/analytics.api.test.ts` | Planned (13 Dec) |
| **TEST-S3-06** | AC-S3-05, AC-S3-06 | F-10 | API / Int | Logged in `OPERATOR` / `CUSTOMER` | `GET /api/operator/analytics?from=2026-12-10&to=2026-12-01` (or as Customer) | `400 Bad Request` for invalid range; `403 Forbidden` for `CUSTOMER` | `server/tests/analytics.api.test.ts` | Planned (13 Dec) |
| **TEST-S3-07** | AC-S3-07, AC-S3-08 | F-11 | API / Int | Customer has past order; catalog price changed from $4.50 to $5.00 | `PATCH /favorite` then `POST /api/orders/:id/reorder` | Favorite toggles; new order `201 Created` billed at current $5.00 price | `server/tests/order-history.api.test.ts` | Planned (13 Dec) |
| **TEST-S3-08** | AC-S3-09 | F-11 | API / Int | Customer past order references item now out of stock (`stockQuantity = 0`) | `POST /api/orders/:id/reorder` | `422 Unprocessable Entity`; no new order saved | `server/tests/order-history.api.test.ts` | Planned (13 Dec) |
