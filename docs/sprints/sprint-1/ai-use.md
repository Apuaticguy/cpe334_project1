# Sprint 1 AI-Use Declaration & Prompt Reflection (ai-use.md)

**Course:** CPE 334 Introduction to Software Engineering in the Age of AI Agents (Semester 1/2026)  
**Project:** QuickOrder (Theme 4: E-Commerce or Ordering System)  
**Milestone:** Deliverable 1 (Engineering Baseline & Working Sprint 1)  
**Authors:** Panyakorn Lohaviboonsap (`67070503424`), Ivan Luwongsuwat (`67070503449`)  
**AI Assistant Platform:** Google Antigravity (Powered by Gemini 3.5 / Gemini Flash)

---

## 1. Selected Key Prompts (Spec DD, Test DD & Implementation)

### Prompt 1: Deriving Engineering Specifications & Acceptance Criteria (Spec DD)
> *"Given the stakeholder request for Theme 4 (QuickOrder: Campus Food & Beverage / Retail Pre-Order System), generate a formal Software Requirements Specification (SRS) and Sprint 1 Acceptance Criteria. Detail the business rules for server authoritative pricing (client-side total tampering prevention), inventory stock availability deduction, and role boundaries between Customer and Operator. Structure them as testable AC-01 through AC-13 statements."*

### Prompt 2: Database Schema & Relational Modeling (Prisma ORM)
> *"Design a PostgreSQL database schema using Prisma for QuickOrder Sprint 1. The schema must model User (roles: CUSTOMER, OPERATOR), CatalogItem (unitPrice in Decimal, stockQuantity in Int, isActive in Boolean), Order (status: SUBMITTED, ACCEPTED, CANCELLED, totalAmount in Decimal), and OrderItem. Crucially, OrderItem must snapshot the purchase unitPrice and lineTotal at time of checkout so subsequent catalog price updates never alter historical orders. Provide idempotent seed data with bcrypt hashed passwords."*

### Prompt 3: TDD Test Specification & Negative Test Matrix (Test DD)
> *"Create a comprehensive test specification (tests.md) for QuickOrder Sprint 1 API using Supertest and Vitest. Define test cases covering: (1) Happy path order creation; (2) Tampered client total where backend ignores client total and enforces database prices; (3) Negative or zero item quantities returning HTTP 400; (4) Quantity exceeding available stock returning HTTP 422 with zero database writes; (5) Cross-customer access where Customer A queries Customer B's private order ID returning HTTP 403 Forbidden."*

### Prompt 4: Authentication, Password Hashing & Role Authorization
> *"Implement authentication routes (`POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`) and middleware in Express with TypeScript. Passwords must be hashed with bcrypt using a minimum salt rounds of 10. Generate HMAC-SHA256 signed JWT tokens carrying user ID and role. Implement an `authenticateToken` middleware and a `requireRole(allowedRoles)` guard that prevents Customers from accessing Operator routes with HTTP 403 Forbidden."*

### Prompt 5: Atomic Order Placement Engine with Transactional Stock Deduction
> *"Write the Express route handler for `POST /api/orders`. The handler must authenticate the Customer, parse requested line items, query the active CatalogItem records, authoritatively calculate subtotal and totalAmount, and verify stock availability. Execute the order creation and inventory decrement inside a single atomic `prisma.$transaction`. If any item has insufficient stock, throw an error to trigger an automatic rollback and respond with HTTP 422."*

### Prompt 6: Customer Order History & Cross-Customer Data Isolation
> *"Implement `GET /api/orders/my-orders` and `GET /api/orders/:id`. Enforce strict ownership protection: only orders where `order.userId === req.user.id` should be returned. If Customer A explicitly attempts to query Customer B's order ID, respond with HTTP 403 Forbidden and zero order details. Include associated line items and historical snapshot unit prices in the response."*

### Prompt 7: Operator Dashboard & State Transition Logic
> *"Implement `GET /api/operator/orders` and `PATCH /api/operator/orders/:id/accept`. Operators must be able to inspect incoming orders with customer contact details and item breakdowns. The accept endpoint must transition the status from `SUBMITTED` to `ACCEPTED`. If the order is already `ACCEPTED` or `CANCELLED`, return HTTP 409 Conflict. Create a React + Bootstrap 5 operator dashboard component displaying summary cards, status badges, and action buttons."*

### Prompt 8: Automated End-to-End Visual Verification Script
> *"Create a Node.js automation script using Puppeteer-core and headless Google Chrome to systematically capture full-resolution PNG screenshots of the running QuickOrder system: (1) Catalog browsing with cart summary; (2) Persisted order history; (3) Insufficient stock rejection banner; (4) Operator order queue with accepted state; and save them directly to `docs/screenshots/`."*

---

## 2. My Reflection on Specification-Agent and Coding-Agent Use

### 2.1 Specification-Agent Reflection (Spec DD)
Using the AI as a **Specification Agent** at the beginning of Sprint 1 was the most impactful architectural decision. Rather than immediately jumping into code, we forced the AI to formalize the domain rules (such as Server Authoritative Pricing, atomic inventory transactions, and cross-customer isolation) into unambiguous Acceptance Criteria (AC-01 through AC-13) in `docs/sprints/sprint-1/specifications.md`. 
* **Key Learning:** AI tools often assume standard happy paths by default unless explicitly prompted to specify failure modes. Prompting the AI to design the negative test matrix *before* coding exposed critical edge cases early—such as what HTTP status code to return when ordering 0 units (400 Bad Request) versus ordering 999 units when only 15 exist (422 Unprocessable Entity).

### 2.2 Coding-Agent Reflection (TDD & Implementation)
When functioning as a **Coding Agent**, the AI accelerated boilerplate scaffolding (Express routers, Prisma schema, TypeScript interfaces, and React Bootstrap components). 
* **TDD Discipline:** By feeding the AI our exact Software Test Specification (`tests.md`), we wrote and verified the automated Supertest and Vitest suites *first*. When running the API suites against local PostgreSQL, the tests caught real-world bugs that the AI initially glossed over—for example, ensuring that price calculations handled JavaScript floating-point inaccuracies by storing prices in Decimal and rounding authoritative totals to two decimal places.
* **Human Oversight & Verification:** Every single file generated by the AI was compiled, tested locally, inspected during peer code review, and merged only after all 34 automated tests passed. AI was never allowed to merge its own code; human review and git branch hygiene (`sprint1-staging` $\rightarrow$ `main`) remained strictly enforced.

