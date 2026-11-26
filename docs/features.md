# Feature Inventory - QuickOrder

**Project:** QuickOrder (Theme 4: E-Commerce or Ordering System)  
**Document Version:** 2.0.0 (Deliverable 2 Contract Baseline — Issue #36)  
**Status:** Updated Feature Inventory  

---

## 1. Feature List Across Sprints 1, 2, and 3

| Feature ID | Feature Name | Description | Target Sprint | Implementation Status | Primary Actor | Dependencies |
|---|---|---|:---:|:---:|:---:|---|
| **F-01** | User Authentication &amp; Role Authorization | Login, logout, credential verification, bcrypt password hashing, and role guard middleware (`CUSTOMER`, `OPERATOR`). | **Sprint 1** | Accepted (`aa632f6`) | Customer, Operator | None |
| **F-02** | Catalog Browsing &amp; Live Availability | Public and authenticated viewing of catalog items, live unit prices, descriptions, and cart stock bounds (`DEF-QO-01`). | **Sprint 1** | Accepted (`8d400ad`) | Customer, Visitor | None |
| **F-03** | Authoritative Order Placement | Customer order submission with line items; server calculates totals authoritatively from DB prices and enforces stock availability. | **Sprint 1** | Accepted (`aa632f6`) | Customer | F-01, F-02 |
| **F-04** | Customer Order History &amp; Detail View | Customer retrieves past orders and inspects full order breakdown with line item snapshot prices and cross-customer isolation. | **Sprint 1** | Accepted (`aa632f6`) | Customer | F-01, F-03 |
| **F-05** | Operator Order Queue &amp; State Acceptance | Operators view all incoming orders and accept submitted orders (`SUBMITTED` $\rightarrow$ `ACCEPTED`). | **Sprint 1** | Accepted (`aa632f6`) | Operator | F-01, F-03 |
| **F-06** | Catalog &amp; Inventory Administration | Operators add new catalog items, edit prices, update descriptions, toggle visibility, and manage inventory stock levels. | **Sprint 2** | Planned D2 (#37) | Operator | F-01, F-02 |
| **F-07** | Order Cancellation &amp; Rejection Workflow | Customers cancel pending orders (`4cedbb5`, Lab 7); operators reject orders with a recorded reason (`#38`), atomically restoring stock. | **Sprint 2** | Partial (`4cedbb5` + #38) | Customer, Operator | F-03, F-05 |
| **F-08** | Simulated Payment Processing | Integration of simulated payment lifecycle (`UNPAID` $\rightarrow$ `PAID` $\rightarrow$ `REFUNDED`) with transaction receipts. | **Sprint 2** | Planned D2 (#39) | Customer, Operator | F-03, F-07 |
| **F-09** | Order Fulfillment &amp; Pickup Notification | Order transitions `ACCEPTED` $\rightarrow$ `READY_FOR_PICKUP` $\rightarrow$ `COMPLETED` with timestamped logs. | **Sprint 3** | Planned D2 (#40) | Operator | F-05, F-08 |
| **F-10** | Sales Analytics &amp; Reporting Dashboard | Aggregate revenue reporting, top-selling items, average order values, and operational metrics. | **Sprint 3** | Planned (13 Dec) | Operator | F-03, F-09 |
| **F-11** | Customer Favorite Orders &amp; Re-Order | Customers save orders as favorites and duplicate past orders with one click at live prices. | **Sprint 3** | Planned (13 Dec) | Customer | F-04 |
