# AI Coding Agent Instructions & Repository Guidelines

## Project Context
- **Course**: CPE 334 Introduction to Software Engineering in the Age of AI Agents (Semester 1/2026)
- **Project Deliverable**: Deliverable 1 (Engineering Baseline & Working Sprint 1)
- **Assigned Theme**: **Theme 4: E-Commerce or Ordering System**
- **Application Name**: **QuickOrder** (Campus Food & Beverage / Retail Pre-Order System)
- **Team Members**:
  - Panyakorn Lohaviboonsap (Student ID: `67070503424`, GitHub: `@panyakornlohaviboonsap`)
  - Ivan Luwongsuwat (Student ID: `67070503449`, GitHub: `@Apuaticguy`)

---

## Strict Course & Engineering Rules

### 1. Scope & Deliverable Boundaries
- **Sprint 1 (Deliverable 1, Due Nov 8)** focuses strictly on:
  - Local running full-stack vertical slice (`client` + `server` + `PostgreSQL` via Prisma).
  - Seeded catalog items and seeded test accounts (`Customer` and `Operator`).
  - Core domain transaction: customer orders line items, server validates and calculates authoritative totals.
  - State transition: operator inspects orders and accepts orders (`SUBMITTED` -> `ACCEPTED`).
  - Automated tests via Vitest & Supertest (persistence, business rules, authorization).
  - Git flow with peer-reviewed Pull Requests.
- **DO NOT** implement GCP deployment, Cloud Run, CI/CD pipelines, or Docker containerization in Sprint 1. Those are assessed in **Lab 5 (Due Nov 15)**.
- **DO NOT** commit real secrets or credentials. Use `.env.example` with synthetic placeholders.

### 2. Git & Kanban Workflow
- **Default / Production Branch**: `main`
- **Integration / Staging Branch**: `sprint1-staging`
- **Feature Branches**: `feature/<issue-number>-<short-description>` branched off `sprint1-staging`.
  - Issue 1: `feature/1-auth-roles` (Assignee: Panyakorn, Reviewer: Ivan)
  - Issue 2: `feature/2-catalog-order` (Assignee: Ivan, Reviewer: Panyakorn)
  - Issue 3: `feature/3-order-history` (Assignee: Panyakorn, Reviewer: Ivan)
  - Issue 4: `feature/4-operator-queue` (Assignee: Ivan, Reviewer: Panyakorn)
- **PR Rules**:
  - All feature PRs **MUST target `sprint1-staging`** (never PR directly into `main`).
  - The PR must be linked to its Issue via GitHub's Development panel.
  - **The author must NEVER approve or merge their own PR**. The reviewer must review the diff, comment, approve, and click merge.
  - Once all 4 features are integrated and passing all tests on `sprint1-staging`, open a release PR from `sprint1-staging` into `main`.

### 3. Testing & TDD Discipline
- Every feature must map directly to the Acceptance Criteria in `docs/sprints/sprint-1/specifications.md` and `docs/sprints/sprint-1/tests.md`.
- Automated tests must cover:
  - Happy path domain journey.
  - Business rule violations (e.g., negative quantities, out-of-stock items, price tampering).
  - Authorization & security (401 unauthenticated, 403 forbidden role access, cross-customer data isolation).
- Never mock persistence when testing backend API routes; use the PostgreSQL test database to verify real transactions.
