# System Software Design Specification (System-Level SDS) - QuickOrder

**Document Version:** 1.0.0  
**Project:** QuickOrder (Theme 4: E-Commerce or Ordering System)  
**Authors:** Panyakorn Lohaviboonsap (67070503424), Ivan (Apuaticguy)  
**Status:** Baseline Draft (Pre-Sprint 1)

---

## 1. System Architecture and Component Responsibilities

QuickOrder is engineered as a full-stack, modular three-tier application communicating over typed JSON REST interfaces.

```mermaid
graph TD
    subgraph "Client Layer (Frontend)"
        A[React 18 + Vite + TypeScript]
        A1[Bootstrap 5 UI + Icons]
        A2[Fetch / Axios API Client]
        A3[Auth Context & Role Guards]
    end

    subgraph "Application Layer (Backend)"
        B[Node.js + Express + TypeScript]
        B1[Auth & JWT Middleware]
        B2[Business Rule Validation Layer]
        B3[Authoritative Pricing Engine]
        B4[Prisma ORM Client]
    end

    subgraph "Persistence Layer (Database)"
        C[(PostgreSQL 15+ Database)]
        C1[Users & Roles Table]
        C2[Catalog Items Table]
        C3[Orders & OrderItems Tables]
    end

    A -->|HTTP / JSON REST APIs| B
    B1 --> B2
    B2 --> B3
    B3 --> B4
    B4 -->|SQL via TCP / Connection Pool| C
```

### 1.1 Layer Responsibilities & Rule Enforcement
* **Frontend Layer (`client/`):** Built with React, Vite, TypeScript, and Bootstrap. Responsible for rendering responsive user interfaces, capturing input, managing local authentication state, displaying clear loading/empty/error states, and preventing invalid form submissions through client-side UX hints. **Client-side controls are advisory only; all business logic is enforced on the server.**
* **API / Application Layer (`server/`):** Built with Node.js, Express, and TypeScript. Acts as the single authoritative source of truth. Responsible for:
  - Validating user credentials and issuing cryptographically signed tokens.
  - Enforcing role-based authorization guards on protected routes.
  - Enforcing all business rules (authoritative unit prices, quantity positivity, stock availability, state transitions).
  - Executing transactional database operations through Prisma ORM.
  - Returning standardized, safe JSON responses and HTTP status codes.
* **Database Layer (`PostgreSQL`):** Responsible for ACID-compliant persistence, foreign-key relational integrity, uniqueness constraints (e.g. `User.email`), and check constraints.

---

## 2. Domain Data Model & Database Setup

### 2.1 Entity Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ ORDER : "places"
    ORDER ||--|{ ORDER_ITEM : "contains"
    CATALOG_ITEM ||--o{ ORDER_ITEM : "referenced by"

    USER {
        int id PK
        string email UK
        string passwordHash
        string fullName
        string role "CUSTOMER | OPERATOR"
        datetime createdAt
    }

    CATALOG_ITEM {
        int id PK
        string name
        string description
        decimal unitPrice
        int stockQuantity
        boolean isActive
        datetime createdAt
    }

    ORDER {
        int id PK
        int userId FK
        string status "SUBMITTED | ACCEPTED | CANCELLED"
        decimal totalAmount
        datetime createdAt
        datetime updatedAt
    }

    ORDER_ITEM {
        int id PK
        int orderId FK
        int catalogItemId FK
        string itemNameSnapshot
        decimal unitPriceSnapshot
        int quantity
        decimal lineTotal
    }
```

### 2.2 Entity Details & Field Constraints

#### 1. `User`
* `id` (Int, Primary Key, autoincrement)
* `email` (String, Unique, normalized lowercase)
* `passwordHash` (String, bcrypt salted hash)
* `fullName` (String)
* `role` (Enum: `CUSTOMER`, `OPERATOR`)
* `createdAt` (DateTime, default `now()`)

#### 2. `CatalogItem`
* `id` (Int, Primary Key, autoincrement)
* `name` (String, indexed)
* `description` (String)
* `unitPrice` (Decimal, 10, 2 - Authoritative base price)
* `stockQuantity` (Int, default 0, constraint: $\ge 0$)
* `isActive` (Boolean, default `true`)
* `createdAt` (DateTime, default `now()`)

#### 3. `Order`
* `id` (Int, Primary Key, autoincrement)
* `userId` (Int, Foreign Key to `User.id`)
* `status` (Enum: `SUBMITTED`, `ACCEPTED`, `CANCELLED`; default `SUBMITTED`)
* `totalAmount` (Decimal, 10, 2 - Authoritative sum calculated by server)
* `createdAt` (DateTime, default `now()`)
* `updatedAt` (DateTime, auto-updated)

#### 4. `OrderItem`
* `id` (Int, Primary Key, autoincrement)
* `orderId` (Int, Foreign Key to `Order.id`, Cascade on delete)
* `catalogItemId` (Int, Foreign Key to `CatalogItem.id`)
* `itemNameSnapshot` (String - Preserved item name at purchase)
* `unitPriceSnapshot` (Decimal, 10, 2 - Preserved purchase price)
* `quantity` (Int, constraint: $\ge 1$)
* `lineTotal` (Decimal, 10, 2: `unitPriceSnapshot * quantity`)

### 2.3 Database Setup, Migrations & Idempotent Seed Data
* Managed via Prisma ORM (`prisma migrate dev`).
* A reproducible seed script (`server/prisma/seed.ts`) executes idempotently using `upsert`.
* Seeded default accounts:
  - **Customer:** `customer1@example.com` / `Password123!` (Role: `CUSTOMER`)
  - **Operator:** `operator1@example.com` / `Password123!` (Role: `OPERATOR`)
* Seeded catalog items:
  - Iced Matcha Latte ($4.50)
  - Artisan Croissant ($3.25)
  - KMUTT Hoodie ($28.00)
  - Canvas Tote Bag ($12.00)

---

## 3. UI, API, and Access Conventions

### 3.1 Main Screens & Shared UI Behavior
1. **Login Screen (`/login`):** Accessible to all; email/password input, client validation, login submit, error alerts on invalid credentials.
2. **Catalog / Store Screen (`/catalog`):** Grid/list of active catalog items with item cards, stock badges, quantity selectors, and "Add to Order" action.
3. **Checkout / Order Review Screen (`/checkout`):** Order summary with selected items, server-calculated subtotal preview, and "Confirm & Place Order" button.
4. **Customer Order History Screen (`/my-orders`):** Lists past orders for current customer with status badges (`SUBMITTED`, `ACCEPTED`), timestamps, and total amounts. Click opens detail breakdown.
5. **Operator Order Queue Screen (`/operator/orders`):** Operator-only dashboard displaying live queue of submitted orders with customer names, timestamps, and an **[Accept Order]** button.

### 3.2 UI States Standard
* **Loading State:** Spinner or animated skeleton showing request in flight.
* **Empty State:** Friendly graphic and clear message (e.g. "No incoming orders in queue", "You haven't placed any orders yet").
* **Error State:** Dismissible Bootstrap alert displaying safe server error message.

### 3.3 API Conventions & Safe Error Handling
* Base Path: `/api`
* Method conventions:
  - `GET`: Idempotent data retrieval (200 OK).
  - `POST`: Resource creation (201 Created).
  - `PATCH`: Status / state transition (200 OK).
* Standard Success Envelope:
  ```json
  {
    "success": true,
    "data": { ... }
  }
  ```
* Standard Error Envelope:
  ```json
  {
    "success": false,
    "error": {
      "code": "OUT_OF_STOCK",
      "message": "Requested item Artisan Croissant is currently out of stock."
    }
  }
  ```

### 3.4 Role & Permission Matrix

| Protected Operation | Endpoint Path & Method | Unauthenticated | Customer Role | Operator Role | Ownership Scope Checked |
|---|---|:---:|:---:|:---:|---|
| **View Catalog** | `GET /api/catalog` | Allowed | Allowed | Allowed | Public |
| **Authenticate** | `POST /api/auth/login` | Allowed | Allowed | Allowed | N/A |
| **Retrieve Current User** | `GET /api/auth/me` | 401 | Allowed | Allowed | Own identity |
| **Place New Order** | `POST /api/orders` | 401 | Allowed | 403 | Bound to `current_user.id` |
| **View My Orders** | `GET /api/orders/my-orders` | 401 | Allowed | 403 | Returns only `userId == current_user.id` |
| **View Order Detail** | `GET /api/orders/:id` | 401 | Conditional | Allowed | 403 if Customer $\neq$ `order.userId` |
| **View Operator Queue** | `GET /api/operator/orders` | 401 | 403 | Allowed | Operator only |
| **Accept Order** | `PATCH /api/operator/orders/:id/accept` | 401 | 403 | Allowed | Operator only |

---

## 4. Authentication, Credentials & Token Lifecycle

* **Password Security:** Hashes stored using `bcrypt` (10 rounds). Plaintext passwords are never logged or stored.
* **Token Creation & Expiry:** Upon successful `POST /api/auth/login`, an HMAC-SHA256 signed JSON Web Token (JWT) is issued containing `{ id, email, role }`. Token validity is set to 8 hours.
* **Token Delivery:** Sent in the `Authorization: Bearer <token>` header or HTTP-only session cookie.
* **Current User Retrieval:** `GET /api/auth/me` decodes the token and returns safe user profile info.
* **Logout Behavior:** Client removes stored token; backend invalidates session state.

---

## 5. Configuration & Delivery Design

* **Environment Variables:** All secrets and environment-specific configs are externalized via `.env` (with `.env.example` committed to Git):
  - `PORT`: HTTP listener port (e.g., 5001).
  - `DATABASE_URL`: PostgreSQL connection string (`postgresql://postgres:postgres@localhost:5432/quickorder_db`).
  - `JWT_SECRET`: Cryptographic signing secret.
  - `NODE_ENV`: `development` | `production` | `test`.
* **Zero Secrets in Git:** Real credentials, passwords, and `.env` files are strictly ignored in `.gitignore`.
* **Docker & GCP Readiness (Lab 5 Preparation):**
  - Application designed statelessly with externalized database connection.
  - Database schema migrations are version-controlled via Prisma migrations.
  - Designed for packaging into lightweight Alpine-based container images for Google Cloud Run deployment in Lab 5.
