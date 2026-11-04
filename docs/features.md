# Feature Inventory - QuickOrder

**Project:** QuickOrder (Theme 4: E-Commerce or Ordering System)  
**Status:** Baseline Draft  

---

## 1. Feature List Across Sprints 1, 2, and 3

| Feature ID | Feature Name | Description | Target Sprint | Primary Actor | Dependencies |
|---|---|---|:---:|:---:|---|
| **F-01** | User Authentication & Role Authorization | Login, logout, credential verification, bcrypt password hashing, and role guard middleware (`CUSTOMER`, `OPERATOR`). | **Sprint 1** | Customer, Operator | None |
| **F-02** | Catalog Browsing & Live Availability | Public and authenticated viewing of catalog items, live unit prices, descriptions, and stock status. | **Sprint 1** | Customer, Visitor | None |
| **F-03** | Authoritative Order Placement | Customer order submission with line items; server calculates totals authoritatively from DB prices and enforces stock availability. | **Sprint 1** | Customer | F-01, F-02 |
| **F-04** | Customer Order History & Detail View | Customer retrieves past orders and inspects full order breakdown with line item snapshot prices and cross-customer isolation. | **Sprint 1** | Customer | F-01, F-03 |
| **F-05** | Operator Order Queue & State Acceptance | Operators view all incoming orders and accept submitted orders (`SUBMITTED` $\rightarrow$ `ACCEPTED`). | **Sprint 1** | Operator | F-01, F-03 |
| **F-06** | Catalog & Inventory Administration | Operators add new catalog items, edit prices, update descriptions, and manage inventory stock levels. | **Sprint 2** | Operator | F-01, F-02 |
| **F-07** | Order Cancellation & Rejection Workflow | Customers cancel pending orders before acceptance; operators reject orders with a recorded reason. | **Sprint 2** | Customer, Operator | F-03, F-05 |
| **F-08** | Simulated Payment Processing | Integration of simulated payment lifecycle (`UNPAID` $\rightarrow$ `PAID` $\rightarrow$ `REFUNDED`) with transaction receipts. | **Sprint 2** | Customer, Operator | F-03, F-07 |
| **F-09** | Order Fulfillment & Pickup Notification | Order transitions to `READY_FOR_PICKUP` and `COMPLETED` with timestamped logs. | **Sprint 3** | Operator | F-05, F-08 |
| **F-10** | Sales Analytics & Reporting Dashboard | Aggregate revenue reporting, top-selling items, average order values, and operational metrics. | **Sprint 3** | Operator | F-03, F-09 |
| **F-11** | Customer Favorite Orders & Re-Order | Customers save orders as favorites and duplicate past orders with one click. | **Sprint 3** | Customer | F-04 |
