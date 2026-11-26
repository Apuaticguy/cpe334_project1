# Requirements-to-Feature-to-Sprint Traceability Matrix - QuickOrder

**Project:** QuickOrder (Theme 4: E-Commerce or Ordering System)  
**Document Version:** 2.0.0 (Deliverable 2 Contract Baseline — Issue #36)  
**Status:** Updated Traceability Matrix  

---

## 1. Full Traceability Table (`FR-01`–`FR-15`, `BR-01`–`BR-14`, `NFR-01`–`NFR-04`)

| Requirement ID | Requirement Summary | Feature ID &amp; Name | Sprint | AC / Verification Target | Planned / Actual Test &amp; File | Status (Pre-Impl) |
|---|---|---|:---:|---|---|---|
| **FR-01** | User authentication &amp; role retrieval | **F-01** Auth &amp; Roles | Sprint 1 | `AC-01`, `AC-02` | `TEST-01`, `TEST-02` (`server/tests/auth.api.test.ts`) | Verified (`aa632f6`) |
| **FR-02** | Catalog browsing &amp; active item listing | **F-02** Catalog Browsing | Sprint 1 | `AC-05` | `TEST-05` (`catalog.api.test.ts`), `TEST-14` (`CatalogList.test.tsx`) | Verified (`aa632f6`) |
| **FR-03** | Server-authoritative order placement | **F-03** Order Placement | Sprint 1 | `AC-06` | `TEST-06` (`server/tests/orders.api.test.ts`) | Verified (`aa632f6`) |
| **FR-04** | Price snapshot preservation on line items | **F-03** Order Placement | Sprint 1 | `AC-06`, `AC-09` | `TEST-06`, `TEST-09` (`orders.api.test.ts`, `order-history.api.test.ts`) | Verified (`aa632f6`) |
| **FR-05** | Customer order history &amp; persisted detail | **F-04** Order History | Sprint 1 | `AC-09` | `TEST-09`, `TEST-15` (`order-history.api.test.ts`, `OrderHistory.test.tsx`) | Verified (`aa632f6`) |
| **FR-06** | Operator order queue view | **F-05** Operator Queue | Sprint 1 | `AC-11` | `TEST-11` (`operator.api.test.ts`, `OperatorDashboard.test.tsx`) | Verified (`aa632f6`) |
| **FR-07** | Operator order acceptance transition | **F-05** Operator Queue | Sprint 1 | `AC-12` | `TEST-12` (`operator.api.test.ts`, `OperatorDashboard.test.tsx`) | Verified (`aa632f6`) |
| **FR-08** | User session logout | **F-01** Auth &amp; Roles | Sprint 1 | `AC-01` / Session reset | Manual UI + `App.tsx` token clear | Verified (`aa632f6`) |
| **BR-01** | Server authoritative pricing (client total ignored) | **F-03** Order Placement | Sprint 1 | `AC-06` | `TEST-06` (`server/tests/orders.api.test.ts`) | Verified (`aa632f6`) |
| **BR-02** | Positive integer quantity ($q \ge 1$) validation | **F-03** Order Placement | Sprint 1 | `AC-07` | `TEST-07` (`server/tests/orders.api.test.ts`) | Verified (`aa632f6`) |
| **BR-03** | Inactive or out-of-stock item rejection | **F-03** Order Placement | Sprint 1 | `AC-08` | `TEST-08` (`server/tests/orders.api.test.ts`) | Verified (`aa632f6`) |
| **BR-04** | Cross-customer order isolation | **F-04** Order History | Sprint 1 | `AC-10` | `TEST-10` (`server/tests/order-history.api.test.ts`) | Verified (`aa632f6`) |
| **BR-05** | Operator role protection (`403 Forbidden`) | **F-05** Operator Queue | Sprint 1 | `AC-04` | `TEST-04`, `[SECURITY / AC-04]` (`auth.api.test.ts`, `operator.api.test.ts`) | Verified (`aa632f6`) |
| **BR-06** | Valid state transition (`SUBMITTED -> ACCEPTED`) | **F-05** Operator Queue | Sprint 1 | `AC-13` | `TEST-13` (`operator.api.test.ts`, `OperatorDashboard.test.tsx`) | Verified (`aa632f6`) |
| **BR-14** | UI cart quantity cap at available stock (`DEF-QO-01`) | **F-02** Catalog Browsing | Lab 6 | `DEF-QO-01` | `[DEF-QO-01 / Issue #27]` (`client/tests/CatalogList.test.tsx`) | Verified (`8d400ad`) |
| **NFR-01** | Bcrypt password hashing (min salt 10) | **F-01** Auth &amp; Roles | Sprint 1 | `AC-01` | `TEST-01` (`auth.api.test.ts`, `prisma/seed.ts`) | Verified (`aa632f6`) |
| **NFR-02** | Unauthenticated request rejection (`401`) | **F-01** Auth &amp; Roles | Sprint 1 | `AC-03` | `TEST-03` (`auth.api.test.ts`, `orders.api.test.ts`, `operator.api.test.ts`) | Verified (`aa632f6`) |
| **NFR-03** | Atomic transaction rollback on order failure | **F-03** Order Placement | Sprint 1 | `AC-08` | `TEST-08` (`orders.api.test.ts`) | Verified (`aa632f6`) |
| **NFR-04** | Endpoint response time &le; 500ms &amp; health probes | System-wide | Sprint 1 / Lab 5 | `/api/health`, `/api/ready` | `server/tests/health.test.ts` + Cloud Run smoke | Verified (`aa632f6`) |
| **FR-09 / BR-07** | Customer self-service order cancellation &amp; atomic stock restore | **F-07** Cancel &amp; Reject | Lab 7 / S2 | `AC-14`, `AC-15`, `AC-16` | `TEST-16`–`TEST-19` (`order-history.api.test.ts`, `OrderHistory.test.tsx`) | Verified (`4cedbb5`) |
| **FR-10 / BR-08** | Operator catalog item CRUD, pricing &amp; stock control | **F-06** Catalog Admin | Sprint 2 | `AC-S2-01`–`AC-S2-04` | `TEST-S2-01`–`04` (`catalog-admin.api.test.ts`), `TEST-S2-13` (`OperatorDashboard.test.tsx`) | Targeted D2 (#37) |
| **FR-11 / BR-09** | Operator order rejection with mandatory reason &amp; stock restore | **F-07** Cancel &amp; Reject | Sprint 2 | `AC-S2-05`–`AC-S2-08` | `TEST-S2-05`–`08` (`operator.api.test.ts`), `TEST-S2-13`–`14` | Targeted D2 (#38) |
| **FR-12 / BR-10** | Simulated payment lifecycle (`UNPAID -> PAID -> REFUNDED`) | **F-08** Simulated Payment | Sprint 2 | `AC-S2-09`–`AC-S2-12` | `TEST-S2-09`–`12` (`payment.api.test.ts`), `TEST-S2-14` (`OrderHistory.test.tsx`) | Targeted D2 (#39) |
| **FR-13 / BR-11** | Order fulfillment (`ACCEPTED -> READY_FOR_PICKUP -> COMPLETED`) | **F-09** Fulfillment | Sprint 3 | `AC-S3-01`–`AC-S3-03` | `TEST-S3-01`–`04` (`operator.api.test.ts`, `OperatorDashboard.test.tsx`) | Targeted D2 (#40) |
| **FR-14 / BR-12** | Sales analytics &amp; revenue reporting excluding cancelled/rejected | **F-10** Sales Analytics | Sprint 3 | `AC-S3-04`–`AC-S3-06` | `TEST-S3-05`–`06` (`analytics.api.test.ts`) | Planned (13 Dec) |
| **FR-15 / BR-13** | Favorite orders &amp; quick re-order at live authoritative prices | **F-11** Favorites &amp; Re-Order | Sprint 3 | `AC-S3-07`–`AC-S3-09` | `TEST-S3-07`–`08` (`order-history.api.test.ts`) | Planned (13 Dec) |

---

## 2. Note on Requirement Numbering Alignment
During Lab 7 maintenance, `FR-09` and `BR-07` were allocated to Customer Order Cancellation (`F-07`). Accordingly, Catalog Administration (`F-06`) is standardized as `FR-10` / `BR-08` in v2.0.0 so every baseline requirement maps uniquely without collisions.
