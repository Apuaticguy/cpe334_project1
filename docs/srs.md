# Software Requirements Specification (SRS) - QuickOrder

**Document Version:** 2.0.0 (Deliverable 2 — Lab 6/7 Revisions + Sprint 2 & Sprint 3 Contracts)  
**Project:** QuickOrder (Theme 4: E-Commerce or Ordering System)  
**Course:** CPE 334 Software Engineering (Semester 1/2026)  
**Authors:** Panyakorn Lohaviboonsap (67070503424), Ivan Luwongsupakit (`@Apuaticguy`)  
**Status:** Deliverable 2 Contract Baseline (Issue #36)

---

## 1. Stakeholder Problem & Context

### 1.1 Stakeholder Problem
Campus food and merchandise kiosks encounter long wait times, inefficient ordering lines, and manual cashier errors during peak hours. Orders placed verbally or via paper slips result in calculation mistakes, inaccurate stock tracking, and uncoordinated fulfillment. Customers face uncertainty regarding order confirmation and status, while operators lack an authoritative digital queue to review and accept incoming orders.

### 1.2 Chosen Context
**QuickOrder** is a specialized pre-order and fulfillment web platform for a campus store / quick-service kiosk. Customers log in to browse available catalog items, select quantities, and place orders. The system enforces server-side authoritative pricing and stock validation. Operators log into an operational dashboard to inspect the queue of submitted orders, verify order details, and transition valid orders to `ACCEPTED` status for preparation.

---

## 2. Actors and Responsibilities

| Actor | Responsibilities | Permissions & Access Scope |
|---|---|---|
| **Customer** | • Browse available catalog items and live unit prices.<br>• Assemble cart items and submit orders.<br>• View own order history and persisted order details.<br>• Cancel own `SUBMITTED` orders (`SUBMITTED` $\rightarrow$ `CANCELLED`) with automatic stock restoration.<br>• Track order status (`SUBMITTED`, `ACCEPTED`, `CANCELLED`). | • May only access catalog and **own** order records.<br>• Cannot alter authoritative catalog prices.<br>• Cannot modify or cancel another customer's order.<br>• Cannot access operator fulfillment views. |
| **Operator** | • View live incoming order queue across the kiosk.<br>• Inspect order line items and customer identifiers.<br>• Accept incoming orders (`SUBMITTED` $\rightarrow$ `ACCEPTED`).<br>• In later sprints: manage catalog pricing, inventory stock, and mark orders fulfilled. | • Full access to order processing and fulfillment endpoints.<br>• Cannot place orders masquerading as another customer.<br>• All status changes are logged with operator timestamp. |
| **System / Unauthenticated Visitor** | • View system health status.<br>• View public catalog listing (read-only). | • Cannot access protected endpoints without a valid session token.<br>• Unauthenticated requests are rejected with `401 Unauthorized`. |

---

## 3. Product Scope and Explicit Exclusions

### 3.1 In Scope (Sprint 1 Baseline)
* Seeded user accounts for Customer and Operator roles with bcrypt password hashing.
* Secure token-based session management (`/api/auth/login`, `/logout`, `/me`).
* Seeded catalog items with prices, descriptions, and stock quantities.
* Authoritative server-side price calculation and item availability checks upon order submission.
* Snapshot price preservation on line items (so historical orders retain the price at time of purchase).
* Customer order history view and order detail inspection with strict cross-customer ownership isolation.
* Operator queue view and order acceptance state transition (`SUBMITTED` $\rightarrow$ `ACCEPTED`).
* Automated unit, API integration (Supertest), and UI component tests (Vitest).

### 3.2 Explicit Exclusions (Later Sprints / Out of Scope)
* **Real Payment Gateway Integration:** Real credit card processing or live banking APIs (simulated payment status only in later sprints; excluded per course spec).
* **Self-Registration & Password Reset:** Self-signup, email confirmation, and password recovery are deferred; seeded demo accounts are used for Sprint 1.
* **External Push Notifications:** SMS, LINE messaging, or email alerts are excluded.
* **Multi-Store Franchising & Warehousing:** Complex multi-tenant inventory networks are excluded.

---

## 4. Functional Requirements (FR)

* **FR-01 (User Authentication):** The system shall authenticate users with email and password, issuing a signed HTTP-only session token and returning user identity and role (`CUSTOMER` or `OPERATOR`).
* **FR-02 (Catalog Browsing):** The system shall display active catalog items with item ID, name, description, unit price, and stock status to authenticated and guest users.
* **FR-03 (Server-Authoritative Order Placement):** When a customer submits an order containing one or more line items and quantities, the server shall independently look up unit prices from the database, compute total amounts, verify stock availability, and persist the order record.
* **FR-04 (Price Snapshot Preservation):** The system shall store the purchased unit price on each `OrderItem` record at the moment of order creation to preserve transaction history against subsequent catalog price changes.
* **FR-05 (Customer Order History & Detail):** The system shall allow authenticated customers to retrieve their own past orders and inspect detailed line items, item names, snapshot unit prices, and overall total.
* **FR-06 (Operator Order Queue):** The system shall provide an operator view listing all incoming orders in descending chronological order with customer identity, order total, status, and creation timestamp.
* **FR-07 (Operator Order Acceptance):** The system shall allow operators to transition an order from `SUBMITTED` to `ACCEPTED` and record the transition timestamp.
* **FR-08 (Session Termination):** The system shall invalidate the active session upon logout and purge client-side session state.
* **FR-09 (Customer Order Cancellation — Lab 7 Revision / F-07):** The system shall allow an authenticated `CUSTOMER` who owns an order (`order.userId == current_user.id`) to cancel that order via `PATCH /api/orders/:id/cancel` while its status is `SUBMITTED`, transitioning status to `CANCELLED`.
* **FR-10 (Catalog & Inventory Administration — Sprint 2 / F-06):** The system shall allow authenticated `OPERATOR` users to create catalog items (`POST /api/operator/catalog`) and update unit price, description, stock quantity, and active state (`PATCH /api/operator/catalog/:id`).
* **FR-11 (Operator Order Rejection — Sprint 2 / F-07):** The system shall allow authenticated `OPERATOR` users to reject a `SUBMITTED` order with a mandatory reason (`PATCH /api/operator/orders/:id/reject`), transitioning status to `REJECTED` and restoring inventory.
* **FR-12 (Simulated Payment Processing — Sprint 2 / F-08):** The system shall track an authoritative simulated payment status (`UNPAID`, `PAID`, `REFUNDED`), transaction reference, and payment timestamp per order (`POST /api/orders/:id/pay`).
* **FR-13 (Order Fulfillment & Ready-for-Pickup Lifecycle — Sprint 3 / F-09):** The system shall allow operators to advance `ACCEPTED` orders to `READY_FOR_PICKUP` and then to `COMPLETED`, recording server timestamps (`readyAt`, `completedAt`).
* **FR-14 (Sales Analytics & Reporting Dashboard — Sprint 3 / F-10, Planned):** The system shall provide operators with aggregated realized revenue, order counts, and top-selling item breakdowns excluding cancelled/rejected orders.
* **FR-15 (Customer Favorite Orders & Quick Re-Order — Sprint 3 / F-11, Planned):** The system shall allow customers to favorite orders and duplicate past orders at current authoritative catalog prices and stock limits.

---

## 5. Business Rules (BR)

* **BR-01 (Server Authoritative Pricing):** The client shall never dictate or submit item prices or calculated total amounts. The server MUST compute the order total solely from authoritative database records. Any total submitted by the client is discarded.
* **BR-02 (Minimum Line Item and Quantity):** An order MUST contain at least one line item. Each line item MUST have an integer quantity of $q \ge 1$. Orders with zero, negative, or fractional quantities shall be rejected with `400 Bad Request`.
* **BR-03 (Item Availability Enforcement):** An order MUST NOT contain inactive items or items whose requested quantity exceeds available stock. Violations shall be rejected with `422 Unprocessable Entity` before order creation.
* **BR-04 (Cross-Customer Data Isolation):** A customer MUST ONLY view orders where `order.userId == current_user.id`. Any attempt by Customer A to query Customer B's order by ID shall be rejected with `403 Forbidden`.
* **BR-05 (Operator Role Protection):** Only authenticated users with the `OPERATOR` role may access operator queue endpoints and execute the `accept` transition. Customer attempts shall be rejected with `403 Forbidden`.
* **BR-06 (Valid State Machine Transition):** An order may only be transitioned to `ACCEPTED` if its current status is `SUBMITTED`. Attempting to accept an order that is cancelled, already accepted, or in an invalid state shall be rejected with `409 Conflict`.
* **BR-07 (Order Cancellation Boundary & Atomic Stock Restoration — Lab 7 Revision):** Only the owning `CUSTOMER` may cancel an order, and only while `order.status === 'SUBMITTED'`. Attempting to cancel an `ACCEPTED` or already `CANCELLED` order shall be rejected with `409 Conflict`. Non-owners or `OPERATOR` users attempting cancellation shall be rejected with `403 Forbidden`. Valid cancellation MUST atomically update `status` to `CANCELLED` and increment `catalog_items.stockQuantity` for every `OrderItem` inside a single database transaction.
* **BR-08 (Catalog Admin Validation & Historical Immutability — Sprint 2 / F-06):** Only `OPERATOR` users may create or modify catalog items. `unitPrice` MUST be $> 0$ and `stockQuantity` MUST be an integer $\ge 0$. Catalog price modifications MUST NOT alter historical `OrderItem.unitPriceSnapshot`.
* **BR-09 (Mandatory Rejection Reason & Atomic Refund/Stock Restore — Sprint 2 / F-07):** Only `OPERATOR` users may reject orders in `SUBMITTED` state, and a non-whitespace `rejectionReason` MUST be provided (`400 Bad Request` otherwise). Rejection atomically restores `stockQuantity` and refunds any `PAID` order.
* **BR-10 (Authoritative Payment & Refund State Guard — Sprint 2 / F-08):** Orders initialize as `UNPAID`. Only the owning `CUSTOMER` may mark an active (`SUBMITTED` or `ACCEPTED`) `UNPAID` order as `PAID`. Cancelling or rejecting a `PAID` order atomically transitions `paymentStatus` to `REFUNDED`.
* **BR-11 (Strict Sequential Fulfillment Transitions — Sprint 3 / F-09):** Orders may only enter `READY_FOR_PICKUP` from `ACCEPTED`, and `COMPLETED` from `READY_FOR_PICKUP`. State skips reject with `409 Conflict`.
* **BR-12 (Realized Revenue Aggregation — Sprint 3 / F-10, Planned):** Analytics revenue totals MUST exclude `CANCELLED`, `REJECTED`, and `REFUNDED` orders.
* **BR-13 (Re-Order Live Price & Stock Enforcement — Sprint 3 / F-11, Planned):** Re-ordering a historical order MUST re-price items using live `CatalogItem.unitPrice` and enforce live `stockQuantity` availability (`FR-03`, `BR-03`).
* **BR-14 (UI Cart Quantity Cap — Lab 6 `DEF-QO-01`):** Client quantity selectors MUST clamp cart quantities to `item.stockQuantity` and disable the `+` control when `currentQty >= item.stockQuantity`.

---

## 6. Non-Functional Requirements (NFR)

* **NFR-01 (Security - Credential Protection):** All user passwords stored in the database MUST be hashed using bcrypt with a minimum salt round of 10. No plaintext passwords shall ever appear in storage or logs. *(Sprint 1; Verified by TEST-01)*
* **NFR-02 (Security - Authorization Boundary):** Unauthenticated requests to protected endpoints (`/api/orders`, `/api/operator/*`) MUST be rejected with HTTP 401 without exposing sensitive internal data. *(Sprint 1; Verified by TEST-02)*
* **NFR-03 (Data Integrity - Transactional Atomicity):** Order creation and line item insertion MUST execute within a single atomic database transaction. If any line item validation fails, the entire transaction shall roll back. *(Sprint 1; Verified by TEST-04)*
* **NFR-04 (Performance - Endpoint Response Time):** The catalog retrieval and order placement endpoints shall respond within 500ms under standard local testing conditions. *(Sprint 1; Verified by API Performance Smoke)*

---

## 7. Assumptions, Design Decisions, and Open Questions

### 7.1 Assumptions
1. Seeded accounts (`customer1@example.com`, `operator1@example.com`) provide sufficient coverage for local assessment without requiring public registration.
2. The kiosk handles synchronous order processing where customers submit orders and wait for operator queue confirmation.

### 7.2 Design Decisions
* **Decision 1 (Monolithic Service Architecture):** A single Express backend communicating with PostgreSQL via Prisma ORM satisfies all Sprint 1 requirements without microservice orchestration complexity.
* **Decision 2 (Database-Backed Snapshot Pricing):** Storing `unitPrice` directly on the `OrderItem` table guarantees complete historical accuracy even if catalog prices change in Sprint 2.
* **Decision 3 (JWT in HTTP-only Cookie / Authorization Header):** Token-based authentication allows clean stateless API testing via Supertest while maintaining secure browser sessions.

### 7.3 Questions and Resolutions
* **Q: Are payment gateways required?**  
  *Resolution:* Per course guidelines, real payment gateways are explicitly excluded. Orders transition through simulated workflow states (`SUBMITTED` $\rightarrow$ `ACCEPTED`).
