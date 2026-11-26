# QuickOrder - Campus Pre-Order & Fulfillment System

> **CPE 334 Introduction to Software Engineering in the Age of AI Agents (Semester 1/2026)**  
> **Project Deliverable 2:** Sprint 2 Completion & Sprint 3 Working Increment  
> **Assigned Theme:** **Theme 4: E-Commerce or Ordering System**  
> **Live Cloud Run Deployment:** [`https://quickorder-wcdixtgbxq-as.a.run.app`](https://quickorder-wcdixtgbxq-as.a.run.app)

---

## 1. Team Members

| Name | Student ID | GitHub Username | Role / Responsibility |
|---|---|---|---|
| **Panyakorn Lohaviboonsap** | `67070503424` | [`@Mixkyy`](https://github.com/Mixkyy) | Full-Stack Engineer (Auth, Contracts, `F-06` Catalog Admin, `F-09` Fulfillment) |
| **Ivan Luwongsupakit** | `67070503449` | [`@Apuaticguy`](https://github.com/Apuaticguy) | Full-Stack Engineer (Catalog, Order Queue, Lab 7 Cancel, `F-07` Reject, `F-08` Payment) |

---

## 2. Project Overview & Current Scope (Deliverable 2)

QuickOrder is a full-stack campus food and merchandise pre-order and fulfillment kiosk powered by Express, Prisma ORM, PostgreSQL, and React:
* **Sprint 1 Baseline (`F-01`–`F-05`):** JWT auth with bcrypt password hashing and role guards (`CUSTOMER`, `OPERATOR`), public catalog browsing with cart stock bounds (`DEF-QO-01`), authoritative server-side order creation & price snapshots, customer order history with ownership isolation, and operator queue acceptance (`SUBMITTED -> ACCEPTED`).
* **Sprint 2 Expansion (`F-06`–`F-08`) + Lab 7 Maintenance:**
  * `F-06`: Operator catalog & inventory CRUD (`POST /api/operator/catalog`, `PATCH /api/operator/catalog/:id`) preserving historical order snapshots.
  * `F-07`: Customer self-cancellation (`PATCH /api/orders/:id/cancel`) and operator order rejection with mandatory reason (`PATCH /api/operator/orders/:id/reject`), both with atomic `$transaction` stock restoration.
  * `F-08`: Simulated payment lifecycle (`UNPAID -> PAID -> REFUNDED`) via `POST /api/orders/:id/pay` with atomic refund upon cancel/reject.
* **Sprint 3 Working Progress (`F-09` Implemented; `F-10`–`F-11` Planned by 13 Dec):**
  * `F-09` *(Implemented in D2)*: Sequential fulfillment lifecycle (`ACCEPTED -> READY_FOR_PICKUP -> COMPLETED`) with authoritative `readyAt` and `completedAt` timestamps.
  * `F-10` & `F-11` *(Planned by 13 Dec)*: Operator sales analytics dashboard and customer favorites / quick re-order.

---

## 3. Technology Stack

* **Frontend:** React 18, TypeScript, Vite, Bootstrap 5, Bootstrap Icons
* **Backend:** Node.js 24, Express, TypeScript
* **Database & ORM:** PostgreSQL 16, Prisma ORM (`server/prisma/migrations/`)
* **Testing:** Vitest, Supertest, React Testing Library
* **Cloud & CI/CD:** Unified multi-stage Docker, GitHub Actions (`ci-docker.yml`, `deploy.yml`), Google Cloud Run + Cloud SQL + Secret Manager

---

## 4. Engineering Documentation Index

* **SRS & Scope:** [`docs/srs.md`](docs/srs.md)
* **Feature Inventory & Traceability:** [`docs/features.md`](docs/features.md) & [`docs/traceability.md`](docs/traceability.md)
* **System-Level SDS:** [`docs/system-sds.md`](docs/system-sds.md)
* **Three-Sprint Plan:** [`docs/sprints/plan.md`](docs/sprints/plan.md)
* **Sprint 1 Contracts & STS:** [`docs/sprints/sprint-1/specifications.md`](docs/sprints/sprint-1/specifications.md) & [`docs/sprints/sprint-1/tests.md`](docs/sprints/sprint-1/tests.md)
* **Sprint 2 Contracts & STS:** [`docs/sprints/sprint-2/specifications.md`](docs/sprints/sprint-2/specifications.md) & [`docs/sprints/sprint-2/tests.md`](docs/sprints/sprint-2/tests.md)
* **Sprint 3 Contracts & STS:** [`docs/sprints/sprint-3/specifications.md`](docs/sprints/sprint-3/specifications.md) & [`docs/sprints/sprint-3/tests.md`](docs/sprints/sprint-3/tests.md)
* **Cloud Deployment (Lab 5), UAT (Lab 6), Maintenance (Lab 7):** [`docs/labs/lab-05/deployment.md`](docs/labs/lab-05/deployment.md), [`docs/labs/lab-06/lab6_report.md`](docs/labs/lab-06/lab6_report.md), [`docs/labs/lab-07/change-impact.md`](docs/labs/lab-07/change-impact.md)

---

## 5. Local Setup, Docker & Quick Start

### 5.1 Prerequisites
* Node.js v20+ (tested on Node v24)
* PostgreSQL 15+ (or Docker Desktop / `docker-compose.yml`)
* npm v9+

### 5.2 Environment Configuration
Copy `.env.example` into `server/` and set local values (never commit `.env` files or real secrets):
```bash
cp server/.env.example server/.env
# Variables: PORT=5001, DATABASE_URL=postgresql://..., JWT_SECRET=<local-dev-secret>, DEMO_USER_PASSWORD=<local-seed-password>
```

### 5.3 Database Migrations & Idempotent Seed
```bash
cd server
npm ci
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
```

**Seeded Synthetic Demo Accounts:**
* **Customer:** `customer1@example.com` (Role: `CUSTOMER`) & `customer2@example.com` (Role: `CUSTOMER`)
* **Operator:** `operator1@example.com` (Role: `OPERATOR`)
* *(Demo password configured via `DEMO_USER_PASSWORD` during seeding and supplied privately in the course handoff.)*

### 5.4 Running Locally or via Docker Compose
```bash
# Option A: Local dev servers
cd server && npm run dev     # API on http://localhost:5001
cd client && npm install && npm run dev  # UI on http://localhost:5173

# Option B: Unified Docker stack
docker compose up --build
```

---

## 6. Running Automated Tests & Production Builds

```bash
# 1. Backend API integration & DB transaction suite (Vitest + Supertest)
cd server && npm run build && npm test

# 2. Frontend UI component suite & Vite bundle (Vitest + RTL)
cd client && npm test && npm run build

# 3. Deployment script & live smoke tests
bash deploy/tests/test_deploy_stub.sh
python3 -m unittest discover -s deploy/tests -p 'test_smoke.py'
python3 deploy/smoke_test.py https://quickorder-wcdixtgbxq-as.a.run.app
```
