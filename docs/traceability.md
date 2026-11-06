# Requirements-to-Feature-to-Sprint Traceability Matrix - QuickOrder

**Project:** QuickOrder (Theme 4: E-Commerce or Ordering System)  
**Status:** Baseline Draft  

---

## 1. Traceability Table

This table maps every baseline Functional Requirement (FR), Business Rule (BR), and Non-Functional Requirement (NFR) to its implementing feature, allocated sprint, and planned verification.

| Requirement ID | Requirement Summary | Feature ID & Name | Sprint | Verification (AC & Test ID) |
|---|---|---|:---:|---|
| **FR-01** | User authentication & role retrieval | **F-01** Authentication & Roles | Sprint 1 | AC-01 / TEST-01 (API: Login & Token) |
| **FR-02** | Catalog browsing & active item listing | **F-02** Catalog Browsing | Sprint 1 | AC-02 / TEST-02 (API: Get Catalog) |
| **FR-03** | Server-authoritative order placement | **F-03** Authoritative Order Placement | Sprint 1 | AC-03 / TEST-03 (API: Submit Order with Authoritative Total) |
| **FR-04** | Price snapshot preservation on line items | **F-03** Authoritative Order Placement | Sprint 1 | AC-04 / TEST-04 (DB: Snapshot Unit Price Persistence) |
| **FR-05** | Customer order history & persisted detail | **F-04** Order History & Detail View | Sprint 1 | AC-05 / TEST-05 (API/UI: Customer Order Lookup) |
| **FR-06** | Operator order queue view | **F-05** Operator Order Queue | Sprint 1 | AC-06 / TEST-06 (API/UI: Operator Order Listing) |
| **FR-07** | Operator order acceptance transition | **F-05** Operator Order Queue | Sprint 1 | AC-07 / TEST-07 (API: Transition `SUBMITTED` $\rightarrow$ `ACCEPTED`) |
| **FR-08** | User session logout | **F-01** Authentication & Roles | Sprint 1 | AC-08 / TEST-08 (API: Session Invalidation) |
| **BR-01** | Server authoritative pricing (client total ignored) | **F-03** Authoritative Order Placement | Sprint 1 | AC-03 / TEST-03 (API: Authoritative Pricing Enforcement) |
| **BR-02** | Positive quantity ($q \ge 1$) validation | **F-03** Authoritative Order Placement | Sprint 1 | AC-03 / TEST-09 (API: Negative/Zero Quantity Rejection) |
| **BR-03** | Inactive or out-of-stock item rejection | **F-03** Authoritative Order Placement | Sprint 1 | AC-03 / TEST-10 (API: Out-of-Stock Item Rejection) |
| **BR-04** | Cross-customer order isolation | **F-04** Order History & Detail View | Sprint 1 | AC-05 / TEST-11 (API: Cross-Customer 403 Forbidden) |
| **BR-05** | Operator role protection on management actions | **F-05** Operator Order Queue | Sprint 1 | AC-06 / TEST-12 (API: Role-Restricted 403 Forbidden) |
| **BR-06** | Valid state machine transition (`SUBMITTED` $\rightarrow$ `ACCEPTED`) | **F-05** Operator Order Queue | Sprint 1 | AC-07 / TEST-13 (API: State Conflict 409 Rejection) |
| **NFR-01** | Bcrypt password hashing (min salt 10) | **F-01** Authentication & Roles | Sprint 1 | AC-01 / TEST-01 (Unit: Password Hash Verification) |
| **NFR-02** | Unauthenticated request rejection (401) | **F-01** Authentication & Roles | Sprint 1 | AC-01 / TEST-14 (API: Unauthenticated 401 Rejection) |
| **NFR-03** | Atomic transaction rollback on order failure | **F-03** Authoritative Order Placement | Sprint 1 | AC-03 / TEST-04 (DB: Transaction Rollback Integrity) |
| **NFR-04** | API response time under 500ms | System-wide responsibility | Sprint 1 | AC-02, AC-03 / TEST-15 (Perf: Smoke Latency Check) |
| **FR-09** | Catalog item creation and price updating | **F-06** Catalog Administration | Sprint 2 | AC-S2-01 / Planned Sprint 2 |
| **FR-10** | Customer order cancellation before acceptance | **F-07** Cancellation Workflow | Sprint 2 | AC-S2-02 / Planned Sprint 2 |
| **FR-11** | Operator order rejection with reason | **F-07** Cancellation Workflow | Sprint 2 | AC-S2-03 / Planned Sprint 2 |
| **FR-12** | Simulated payment authorization & refund | **F-08** Simulated Payment | Sprint 2 | AC-S2-04 / Planned Sprint 2 |
| **FR-13** | Ready-for-pickup transition & logging | **F-09** Fulfillment Workflow | Sprint 3 | AC-S3-01 / Planned Sprint 3 |
| **FR-14** | Sales revenue & item analytics reporting | **F-10** Sales Analytics | Sprint 3 | AC-S3-02 / Planned Sprint 3 |
| **FR-15** | Order duplication & favorite marking | **F-11** Favorites & Re-Order | Sprint 3 | AC-S3-03 / Planned Sprint 3 |

---

## 2. Coverage Summary
* **Total Baseline Requirements:** 18 Sprint 1 items (8 FRs, 6 BRs, 4 NFRs) + 7 Future sprint items.
* **Sprint 1 Coverage:** 100% of Sprint 1 requirements mapped to specific Features and Test IDs.
* **Gaps or Uncovered Rules:** None.
