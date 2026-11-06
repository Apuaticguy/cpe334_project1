# Sprint 1 Engineering Contracts & Feature Specifications - QuickOrder

**Document Version:** 1.0.0  
**Target Milestone:** Deliverable 1 (8 November 2026)  
**Authors:** Panyakorn Lohaviboonsap (67070503424), Ivan (Apuaticguy)  
**Status:** Approved for Sprint 1 Implementation  

---

## 1. Feature Engineering Contract: F-01 (Authentication & Role Guards)

* **Linked Requirements:** FR-01, FR-08, NFR-01, NFR-02  
* **Assignee:** Panyakorn Lohaviboonsap (`@panyakornlohaviboonsap`)  
* **Reviewer:** Ivan (`@Apuaticguy`)  
* **Branch:** `feature/1-auth-roles`  

### 1.1 Behavior & Workflow
Users authenticate with email and password. Upon successful validation, the server generates an HMAC-SHA256 signed JWT containing the user ID, email, and role. The token is stored by the client and sent in subsequent requests. The backend validates tokens via an authentication middleware and enforces role access (`CUSTOMER`, `OPERATOR`).

### 1.2 API Specifications

#### `POST /api/auth/login`
* **Request:**
  ```json
  {
    "email": "customer1@example.com",
    "password": "Password123!"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": 1,
        "email": "customer1@example.com",
        "fullName": "Alice Customer",
        "role": "CUSTOMER"
      }
    }
  }
  ```
* **Error Response (401 Unauthorized):**
  ```json
  {
    "success": false,
    "error": { "message": "Invalid email or password" }
  }
  ```

#### `GET /api/auth/me`
* **Headers:** `Authorization: Bearer <token>`
* **Success Response (200 OK):** Current authenticated user profile.
* **Error Response (401 Unauthorized):** When token is missing, expired, or tampered.

#### `POST /api/auth/logout`
* **Success Response (200 OK):**
  ```json
  { "success": true, "data": { "message": "Logged out successfully" } }
  ```

### 1.3 Acceptance Criteria
* **AC-01:** Given valid registered credentials, when `POST /api/auth/login` is called, the server returns HTTP 200, an HMAC-signed token, and user details.
* **AC-02:** Given incorrect password or non-existent email, when `POST /api/auth/login` is called, the server returns HTTP 401 with a safe error message without revealing user existence.
* **AC-03:** Given a protected endpoint without an Authorization header, the server returns HTTP 401 Unauthorized.
* **AC-04:** Given a Customer trying to access an Operator endpoint (`/api/operator/*`), the server returns HTTP 403 Forbidden.

---

## 2. Feature Engineering Contract: F-02 & F-03 (Catalog & Authoritative Order Placement)

* **Linked Requirements:** FR-02, FR-03, FR-04, BR-01, BR-02, BR-03, NFR-03  
* **Assignee:** Ivan (`@Apuaticguy`)  
* **Reviewer:** Panyakorn Lohaviboonsap (`@panyakornlohaviboonsap`)  
* **Branch:** `feature/2-catalog-order`  

### 2.1 Behavior & Workflow
Customers view the seeded catalog. During order placement, the client transmits an array of `{ catalogItemId, quantity }`. The server independently looks up authoritative database prices, validates positive integer quantities, verifies item stock availability, computes the total order amount, creates an `Order` and associated `OrderItem` snapshot records within an atomic transaction.

### 2.2 API Specifications

#### `GET /api/catalog`
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "name": "Iced Matcha Latte",
        "description": "Ceremonial grade Japanese green tea latte",
        "unitPrice": "4.50",
        "stockQuantity": 50,
        "isActive": true
      }
    ]
  }
  ```

#### `POST /api/orders`
* **Headers:** `Authorization: Bearer <token>`
* **Request:**
  ```json
  {
    "items": [
      { "catalogItemId": 1, "quantity": 2 },
      { "catalogItemId": 2, "quantity": 1 }
    ]
  }
  ```
  *(Note: Even if client sends a tampered "totalAmount": 0.01, the server ignores it and computes authoritative sum).*
* **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "id": 101,
      "status": "SUBMITTED",
      "totalAmount": "12.25",
      "createdAt": "2026-11-05T00:30:00.000Z",
      "items": [
        {
          "catalogItemId": 1,
          "itemName": "Iced Matcha Latte",
          "unitPrice": "4.50",
          "quantity": 2,
          "lineTotal": "9.00"
        },
        {
          "catalogItemId": 2,
          "itemName": "Artisan Croissant",
          "unitPrice": "3.25",
          "quantity": 1,
          "lineTotal": "3.25"
        }
      ]
    }
  }
  ```
* **Error Response (400 Bad Request):** Zero or negative quantities.
* **Error Response (422 Unprocessable Entity):** Inactive or out-of-stock items.

### 2.3 Acceptance Criteria
* **AC-05:** When `GET /api/catalog` is invoked, it returns all active catalog items with authoritative prices.
* **AC-06:** When a customer submits a valid order, the server computes the authoritative total, preserves unit price snapshots, and persists the order with status `SUBMITTED`.
* **AC-07:** When an order contains zero, negative, or non-integer quantities, the server rejects the request with HTTP 400.
* **AC-08:** When an order requests an item exceeding available stock, the server rejects the request with HTTP 422 and persists no order records.

---

## 3. Feature Engineering Contract: F-04 (Customer Order History & Detail)

* **Linked Requirements:** FR-05, BR-04  
* **Assignee:** Panyakorn Lohaviboonsap (`@panyakornlohaviboonsap`)  
* **Reviewer:** Ivan (`@Apuaticguy`)  
* **Branch:** `feature/3-order-history`  

### 3.1 Behavior & Workflow
Customers retrieve their past order summaries. Clicking an order loads full line-item details. The backend strictly ensures Customer A cannot query Customer B's orders.

### 3.2 API Specifications
* `GET /api/orders/my-orders`: Returns array of orders for authenticated user.
* `GET /api/orders/:id`: Returns single order detail; returns `403 Forbidden` if `order.userId != current_user.id`.

### 3.3 Acceptance Criteria
* **AC-09:** Given an authenticated customer, `GET /api/orders/my-orders` returns only orders belonging to that customer.
* **AC-10:** Given Customer A requests Customer B's order ID via `GET /api/orders/:id`, the server rejects with HTTP 403 Forbidden without disclosing private data.

---

## 4. Feature Engineering Contract: F-05 (Operator Order Queue & State Acceptance)

* **Linked Requirements:** FR-06, FR-07, BR-05, BR-06  
* **Assignee:** Ivan (`@Apuaticguy`)  
* **Reviewer:** Panyakorn Lohaviboonsap (`@panyakornlohaviboonsap`)  
* **Branch:** `feature/4-operator-queue`  

### 4.1 Behavior & Workflow
Operators view live incoming orders in descending chronological order. Operators click **[Accept Order]** to change status from `SUBMITTED` to `ACCEPTED`. Invalid state transitions are rejected with `409 Conflict`.

### 4.2 API Specifications
* `GET /api/operator/orders`: Operator-only listing of all orders.
* `PATCH /api/operator/orders/:id/accept`: Operator-only state transition to `ACCEPTED`.

### 4.3 Acceptance Criteria
* **AC-11:** Given an authenticated Operator, `GET /api/operator/orders` returns all submitted orders with customer names and totals.
* **AC-12:** Given an order with status `SUBMITTED`, an operator calling `PATCH /api/operator/orders/:id/accept` transitions status to `ACCEPTED` and updates `updatedAt`.
* **AC-13:** Given an order already in `ACCEPTED` status, calling `PATCH /api/operator/orders/:id/accept` rejects with HTTP 409 Conflict.

---

## 5. Product Definition of Done (DoD)

A Sprint 1 feature is strictly considered **Done** only when all of the following conditions are verified:
1. **Implementation Complete:** Backend endpoints, data models, and UI screens conform to the feature specifications.
2. **Automated Verification:** All mapped Supertest and Vitest test cases execute and pass without skipping or disabled assertions.
3. **Database Integrity:** Migrations run cleanly from scratch; seed script executes idempotently.
4. **Git Discipline:** Feature developed on designated `feature/<issue>-<name>` branch.
5. **Peer Review:** Pull Request opened to `sprint1-staging`, reviewed by teammate with substantive comments, and merged by the reviewer (not author).
6. **Documentation Current:** `README.md`, `.env.example`, and test logs updated with tested commit hashes.
