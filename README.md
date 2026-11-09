# QuickOrder - Campus Pre-Order & Fulfillment System

> **CPE 334 Introduction to Software Engineering in the Age of AI Agents (Semester 1/2026)**  
> **Project Deliverable 1:** Engineering Baseline & Working Sprint 1  
> **Assigned Theme:** **Theme 4: E-Commerce or Ordering System**  

---

## 1. Team Members

| Name | Student ID | GitHub Username | Role / Responsibility |
|---|---|---|---|
| **Panyakorn Lohaviboonsap** | `67070503424` | [`@panyakornlohaviboonsap`](https://github.com/panyakornlohaviboonsap) | Full-Stack Engineer (Auth & Order History) |
| **Ivan Luwongsuwat** | `67070503449` | [`@Apuaticguy`](https://github.com/Apuaticguy) | Full-Stack Engineer (Catalog & Order Queue) |

---

## 2. Project Overview

QuickOrder is a fast, reliable, full-stack pre-order and fulfillment system designed for campus kiosks and retail outlets.
- **Customers** log in, view live catalog items and prices, submit orders with multiple line items, and inspect their persisted order history.
- **Operators** log into an operational dashboard to view incoming orders and transition valid orders from `SUBMITTED` to `ACCEPTED`.
- **Authoritative Server Pricing:** Order totals are computed authoritatively on the backend using database unit prices to prevent client-side price tampering. Line items snapshot the purchase price to guarantee historical accuracy.
- **Strict Role Isolation:** Backend route guards strictly isolate customer records and restrict operator endpoints.

---

## 3. Technology Stack

* **Frontend:** React 18, TypeScript, Vite, Bootstrap 5, Bootstrap Icons
* **Backend:** Node.js, Express, TypeScript
* **Database & ORM:** PostgreSQL 15+, Prisma ORM
* **Testing:** Vitest, Supertest
* **Authentication:** JWT with bcrypt salted password hashing (min salt 10)

---

## 4. Engineering Documentation Index

The complete engineering baseline is version-controlled in the repository:
* **Part A: SRS and Product Scope:** [`docs/srs.md`](docs/srs.md)
* **Part B: Feature Inventory & Traceability:** [`docs/features.md`](docs/features.md) & [`docs/traceability.md`](docs/traceability.md)
* **Part C: System-Level SDS:** [`docs/system-sds.md`](docs/system-sds.md)
* **Part D: Three-Sprint Plan:** [`docs/sprints/plan.md`](docs/sprints/plan.md)
* **Part E: Sprint 1 Engineering Contracts & STS:** [`docs/sprints/sprint-1/specifications.md`](docs/sprints/sprint-1/specifications.md) & [`docs/sprints/sprint-1/tests.md`](docs/sprints/sprint-1/tests.md)
* **Sprint 1 Peer Review Log:** [`docs/sprints/sprint-1/reviewer.md`](docs/sprints/sprint-1/reviewer.md)
* **Sprint 1 AI-Use Declaration & Prompts:** [`docs/sprints/sprint-1/ai-use.md`](docs/sprints/sprint-1/ai-use.md)
* **Deliverable 1 Master Report (Parts A-F):** [`docs/deliverable1_report.md`](docs/deliverable1_report.md)
* **AI Coding Agent Guidelines:** [`AGENTS.md`](AGENTS.md)

---

## 5. Local Setup & Quick Start

### 5.1 Prerequisites
* Node.js v18+ (tested on Node v24)
* PostgreSQL 15+ (local instance or Docker container on port `5432`)
* npm v9+

### 5.2 Environment Configuration
Copy `.env.example` into both `server/` and `client/`:
```bash
cp .env.example server/.env
cp .env.example client/.env
```

### 5.3 Database Setup, Migrations & Seed
```bash
cd server
npm install
npx prisma migrate dev --name init
npm run seed
```

**Seeded Demo Accounts:**
| Role | Email | Password |
|---|---|---|
| **Customer** | `customer1@example.com` | `Password123!` |
| **Operator** | `operator1@example.com` | `Password123!` |

### 5.4 Starting the Application
```bash
# Terminal 1: Backend API (runs on port 5001)
cd server
npm run dev

# Terminal 2: Frontend Client (runs on port 5173)
cd client
npm install
npm run dev
```
Open browser at: `http://localhost:5173`

---

## 6. Running Automated Tests

```bash
# Run server API integration tests (Supertest + Vitest)
cd server
npm test

# Run client UI component tests (Vitest)
cd client
npm test
```