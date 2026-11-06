# Software Test Specification (STS) - Sprint 1

**Project:** QuickOrder (Theme 4: E-Commerce or Ordering System)  
**Document Version:** 1.0.0  
**Status:** Approved Test Plan  

---

## 1. Test Suite Mapping & Software Test Specification

| Test ID | Linked AC | Test Level | Preconditions / Input | Action / Request | Expected Result | Automated Test File |
|---|---|:---:|---|---|---|---|
| **TEST-01** | AC-01 | API / Int | Seeded user `customer1@example.com` exists | `POST /api/auth/login` with correct password | 200 OK, returns signed JWT & user profile | `server/tests/auth.api.test.ts` |
| **TEST-02** | AC-02 | API / Int | Seeded user exists | `POST /api/auth/login` with wrong password | 401 Unauthorized, safe error message | `server/tests/auth.api.test.ts` |
| **TEST-03** | AC-03 | API / Int | None | `GET /api/auth/me` without Authorization header | 401 Unauthorized | `server/tests/auth.api.test.ts` |
| **TEST-04** | AC-04 | API / Int | Logged in as `CUSTOMER` | `GET /api/operator/orders` | 403 Forbidden | `server/tests/auth.api.test.ts` |
| **TEST-05** | AC-05 | API / Int | Seeded catalog items exist | `GET /api/catalog` | 200 OK, returns array of active catalog items | `server/tests/catalog.api.test.ts` |
| **TEST-06** | AC-06 | API / Int | Logged in Customer; items with stock in DB | `POST /api/orders` with 2 items and client-tampered total | 201 Created; server computes authoritative total; unit price snapshot saved | `server/tests/orders.api.test.ts` |
| **TEST-07** | AC-07 | API / Int | Logged in Customer | `POST /api/orders` with quantity = -1 | 400 Bad Request, rejection error message | `server/tests/orders.api.test.ts` |
| **TEST-08** | AC-08 | API / Int | Logged in Customer; item stock = 5 | `POST /api/orders` with quantity = 999 | 422 Unprocessable Entity; no order saved | `server/tests/orders.api.test.ts` |
| **TEST-09** | AC-09 | API / Int | Customer has 2 existing orders | `GET /api/orders/my-orders` | 200 OK, returns exactly the 2 orders | `server/tests/orders.api.test.ts` |
| **TEST-10** | AC-10 | API / Int | Customer A logged in; Order #2 belongs to Customer B | `GET /api/orders/2` | 403 Forbidden without exposing Customer B data | `server/tests/orders.api.test.ts` |
| **TEST-11** | AC-11 | API / Int | Logged in Operator; submitted orders exist | `GET /api/operator/orders` | 200 OK, returns array of all submitted orders | `server/tests/operator.api.test.ts` |
| **TEST-12** | AC-12 | API / Int | Logged in Operator; Order #1 is `SUBMITTED` | `PATCH /api/operator/orders/1/accept` | 200 OK, status changes to `ACCEPTED` | `server/tests/operator.api.test.ts` |
| **TEST-13** | AC-13 | API / Int | Logged in Operator; Order #1 is already `ACCEPTED` | `PATCH /api/operator/orders/1/accept` | 409 Conflict, invalid transition rejected | `server/tests/operator.api.test.ts` |
| **TEST-14** | AC-05 | UI / Vitest | Catalog API mocked | Render `<CatalogList />` component | Displays item cards, stock status, and add-to-cart buttons | `client/tests/CatalogList.test.tsx` |
| **TEST-15** | AC-09 | UI / Vitest | Orders API mocked with empty array | Render `<OrderHistory />` component | Displays empty state: "You have not placed any orders yet" | `client/tests/OrderHistory.test.tsx` |

---

## 2. Test Execution Commands

```bash
# Run all server API integration tests
cd server && npm test

# Run all client UI component tests
cd client && npm test
```
