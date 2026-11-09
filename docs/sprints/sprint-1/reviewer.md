# Sprint 1 Code Review & Peer Approval Log (reviewer.md)

**Course:** CPE 334 Introduction to Software Engineering in the Age of AI Agents (Semester 1/2026)  
**Project:** QuickOrder (Theme 4: E-Commerce or Ordering System)  
**Target Milestone:** Deliverable 1 (Working Sprint 1 & Engineering Baseline)  
**Repository:** [`https://github.com/Apuaticguy/cpe334_project1`](https://github.com/Apuaticguy/cpe334_project1)  
**Default Branch:** `main` | **Integration Branch:** `sprint1-staging`

---

## 1. Team Peer Review Agreement & Rules
In accordance with CPE 334 Engineering Workflow guidelines:
1. **Separation of Author & Reviewer:** The author of a Pull Request must never approve or merge their own PR.
2. **Reviewer Merges:** The designated peer reviewer must inspect the code diff, verify test execution against the acceptance criteria, provide substantive comments, approve the PR, and click **Merge pull request**.
3. **Conversational Review:** The author must reply to each review comment explaining what was changed or clarifying the design before the conversation is resolved.
4. **Staging Flow:** All feature branches (`feature/<issue>-<name>`) target `sprint1-staging`. After full integration and test verification, `sprint1-staging` is merged into `main` via Release PR #9.

---

## 2. Peer Review Log by Feature

### Feature 1: Authentication, Role Guards & Current User State
* **Issue Link:** [Issue #1](https://github.com/Apuaticguy/cpe334_project1/issues/1)
* **Pull Request:** [PR #5: feat(auth): implement user authentication, role guards, and automated test suite](https://github.com/Apuaticguy/cpe334_project1/pull/5)
* **Author:** Panyakorn Lohaviboonsap (`@panyakornlohaviboonsap`)
* **Reviewer:** Ivan Luwongsuwat (`@Apuaticguy`)
* **Target Branch:** `sprint1-staging`
* **Status:** Approved and merged by Ivan

#### Review Comments & Conversation:
* **Ivan (Reviewer):**
  > *"Checked `server/src/middlewares/auth.middleware.ts` and `server/src/routes/auth.routes.ts`. Password hashing uses bcrypt with 10 salt rounds which matches NFR-01. JWT payload carries `{ id, email, role }`. In `tests/auth.api.test.ts`, verified 8/8 test cases pass covering 401 unauthenticated and 403 customer access to operator endpoints. Did you ensure expired or malformed tokens return a clean 401 instead of a 500 server crash?"*
* **Panyakorn (Author):**
  > *"Yes, in `authenticateToken` middleware, the JWT verification callback catches `JsonWebTokenError` and `TokenExpiredError` explicitly and returns HTTP 401 with `{ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } }`."*
* **Ivan (Reviewer):**
  > *"Verified locally. Tests run cleanly. Approved and merged into `sprint1-staging`."*

---

### Feature 2: Catalog Browsing & Authoritative Server Order Placement
* **Issue Link:** [Issue #2](https://github.com/Apuaticguy/cpe334_project1/issues/2)
* **Pull Request:** [PR #6: feat(catalog,orders): implement catalog browsing, authoritative order placement, and automated tests](https://github.com/Apuaticguy/cpe334_project1/pull/6)
* **Author:** Ivan Luwongsuwat (`@Apuaticguy`)
* **Reviewer:** Panyakorn Lohaviboonsap (`@panyakornlohaviboonsap`)
* **Target Branch:** `sprint1-staging`
* **Status:** Approved and merged by Panyakorn

#### Review Comments & Conversation:
* **Panyakorn (Reviewer):**
  > *"Reviewed the order creation engine in `server/src/routes/orders.routes.ts`. Authoritative Pricing (BR-01 / AC-06) is properly enforced: the server queries database unit prices for each requested item, recalculates line totals, and completely ignores any client-supplied totals. Stock deduction occurs within `prisma.$transaction`. However, make sure that if any single item has insufficient stock, the whole transaction rolls back and returns 422 with zero items deducted."*
* **Ivan (Author):**
  > *"Confirmed. Inside `prisma.$transaction`, if `item.stockQuantity < requestedQuantity`, we throw an explicit domain error before creating the Order record, which rolls back all atomic operations and returns HTTP 422 with the exact stock availability in the error message. Added unit test `TEST-08` verifying this behavior."*
* **Panyakorn (Reviewer):**
  > *"Ran `npm test` in both server and client. All 5 test suites pass (including CatalogList UI test). Approved and merged into `sprint1-staging`."*

---

### Feature 3: Customer Order History & Cross-Customer Isolation
* **Issue Link:** [Issue #3](https://github.com/Apuaticguy/cpe334_project1/issues/3)
* **Pull Request:** [PR #7: feat(orders): implement customer order history, detail view, and cross-customer isolation](https://github.com/Apuaticguy/cpe334_project1/pull/7)
* **Author:** Panyakorn Lohaviboonsap (`@panyakornlohaviboonsap`)
* **Reviewer:** Ivan Luwongsuwat (`@Apuaticguy`)
* **Target Branch:** `sprint1-staging`
* **Status:** Approved and merged by Ivan

#### Review Comments & Conversation:
* **Ivan (Reviewer):**
  > *"Verified `GET /api/orders/my-orders` and `GET /api/orders/:id`. The query filter `where: { userId: req.user.id }` guarantees Customer A cannot see Customer B's orders. In `OrderHistory.tsx`, past orders display status badges correctly and accordion cards expand to show item snapshots. Verified Vitest tests in `tests/order-history.api.test.ts` where cross-customer lookup returns 403 Forbidden without disclosing order existence."*
* **Panyakorn (Author):**
  > *"Also verified that the snapshot unit price (`OrderItem.unitPrice`) is retrieved rather than current catalog price, so price changes in the catalog will never alter past order records."*
* **Ivan (Reviewer):**
  > *"Excellent, historical consistency preserved. Approved and merged into `sprint1-staging`."*

---

### Feature 4: Operator Order Queue & State Transitions
* **Issue Link:** [Issue #4](https://github.com/Apuaticguy/cpe334_project1/issues/4)
* **Pull Request:** [PR #8: feat(operator): implement operator order queue, state transitions, and dashboard UI](https://github.com/Apuaticguy/cpe334_project1/pull/8)
* **Author:** Ivan Luwongsuwat (`@Apuaticguy`)
* **Reviewer:** Panyakorn Lohaviboonsap (`@panyakornlohaviboonsap`)
* **Target Branch:** `sprint1-staging`
* **Status:** Approved and merged by Panyakorn

#### Review Comments & Conversation:
* **Panyakorn (Reviewer):**
  > *"Inspected `server/src/routes/operator.routes.ts` and `OperatorDashboard.tsx`. `requireRole(['OPERATOR'])` middleware blocks non-operator access. State transition logic (BR-06 / AC-12, AC-13) verified: PATCH transitions `SUBMITTED` to `ACCEPTED`, and calling accept on an already accepted order returns HTTP 409 Conflict. The UI reflects the state change immediately with a green badge and banner."*
* **Ivan (Author):**
  > *"Tested conflict handling in `tests/operator.api.test.ts` (`TEST-13`), and verified responsive table layout with loading indicators and error retry controls."*
* **Panyakorn (Reviewer):**
  > *"All 6 operator API tests and 5 operator UI component tests pass. Approved and merged into `sprint1-staging`."*

---

### Release PR: Sprint 1 Working Increment (Deliverable 1)
* **Pull Request:** [PR #9: release: Sprint 1 Working Increment (Deliverable 1)](https://github.com/Apuaticguy/cpe334_project1/pull/9)
* **Branches:** `sprint1-staging` $\rightarrow$ `main`
* **Collaborative Verification:**
  - Full automated suite: 34 tests passing (26 server integration tests + 8 client UI tests, 100% pass rate).
  - Database seed and migrations executed cleanly against PostgreSQL.
  - Release tagged as `v1.0.0-sprint1` on `main`.
* **Merged by:** Team into `main` (Commit `46015d589fc18622d8677bde95c3944fda3ffa08`).

