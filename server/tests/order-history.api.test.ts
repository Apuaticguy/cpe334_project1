import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/prisma.js';
import bcrypt from 'bcryptjs';
import { Role, OrderStatus } from '@prisma/client';

describe('Feature 3: Customer Order History & Ownership Protection API Tests', () => {
  let customer1Token: string;
  let customer2Token: string;
  let operatorToken: string;
  let customer1Id: number;
  let customer2Id: number;
  let customer1OrderId: number;
  let customer2OrderId: number;

  beforeAll(async () => {
    await prisma.$connect();

    // 1. Authenticate Customer 1
    const login1 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer1@example.com', password: 'Password123!' });
    customer1Token = login1.body.data.token;
    customer1Id = login1.body.data.user.id;

    // 2. Ensure Customer 2 exists for cross-customer isolation testing
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const customer2 = await prisma.user.upsert({
      where: { email: 'customer2@example.com' },
      update: {},
      create: {
        email: 'customer2@example.com',
        passwordHash,
        fullName: 'Bob SecondCustomer',
        role: Role.CUSTOMER
      }
    });
    customer2Id = customer2.id;

    const login2 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer2@example.com', password: 'Password123!' });
    customer2Token = login2.body.data.token;

    // 3. Authenticate Operator
    const loginOp = await request(app)
      .post('/api/auth/login')
      .send({ email: 'operator1@example.com', password: 'Password123!' });
    operatorToken = loginOp.body.data.token;

    // 4. Fetch a catalog item to place test orders
    const item = await prisma.catalogItem.findFirst({ where: { isActive: true, stockQuantity: { gt: 5 } } });
    if (!item) throw new Error('Seeded catalog item with sufficient stock not found');

    // Create an order for Customer 1
    const order1Res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({
        items: [{ catalogItemId: item.id, quantity: 1 }]
      });
    customer1OrderId = order1Res.body.data.id;

    // Create an order for Customer 2
    const order2Res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({
        items: [{ catalogItemId: item.id, quantity: 2 }]
      });
    customer2OrderId = order2Res.body.data.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // TEST-09: Customer retrieves own order history
  it('[TEST-09 / AC-09] GET /api/orders/my-orders returns only orders belonging to the authenticated customer', async () => {
    const res = await request(app)
      .get('/api/orders/my-orders')
      .set('Authorization', `Bearer ${customer1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    // Verify all returned orders belong to Customer 1 and do not include Customer 2's orders
    const returnedIds = res.body.data.map((o: any) => o.id);
    expect(returnedIds).toContain(customer1OrderId);
    expect(returnedIds).not.toContain(customer2OrderId);

    // Verify line item details are included
    const firstOrder = res.body.data.find((o: any) => o.id === customer1OrderId);
    expect(firstOrder.items).toBeDefined();
    expect(firstOrder.items.length).toBeGreaterThanOrEqual(1);
    expect(firstOrder.items[0].itemName).toBeDefined();
    expect(firstOrder.items[0].unitPrice).toBeDefined();
  });

  // TEST-10: Cross-Customer Access Rejection (BR-04 / AC-10)
  it('[TEST-10 / AC-10] GET /api/orders/:id returns 403 Forbidden when Customer A requests Customer B order', async () => {
    // Customer 1 attempts to query Customer 2's private order
    const res = await request(app)
      .get(`/api/orders/${customer2OrderId}`)
      .set('Authorization', `Bearer ${customer1Token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.data).toBeUndefined(); // Crucial: private data must not leak!
  });

  // Authenticated customer accesses their own order
  it('GET /api/orders/:id returns 200 OK when customer accesses their own order', async () => {
    const res = await request(app)
      .get(`/api/orders/${customer1OrderId}`)
      .set('Authorization', `Bearer ${customer1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(customer1OrderId);
    expect(res.body.data.userId).toBe(customer1Id);
    expect(res.body.data.items).toBeDefined();
  });

  // Operator can inspect any order
  it('GET /api/orders/:id returns 200 OK when Operator inspects a customer order', async () => {
    const res = await request(app)
      .get(`/api/orders/${customer1OrderId}`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(customer1OrderId);
  });

  // 401 Unauthenticated checks
  it('GET /api/orders/my-orders without token returns 401 Unauthorized', async () => {
    const res = await request(app).get('/api/orders/my-orders');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/orders/:id without token returns 401 Unauthorized', async () => {
    const res = await request(app).get(`/api/orders/${customer1OrderId}`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Lab 7 (Issue #30 / #32): Customer Order Cancellation & Atomic Stock Restore
  // ---------------------------------------------------------------------------

  // TEST-16 / AC-14: Owning CUSTOMER cancels SUBMITTED order -> 200 OK & stock restored
  it('[TEST-16 / AC-14] PATCH /api/orders/:id/cancel transitions SUBMITTED order to CANCELLED and atomically restores stock', async () => {
    const item = await prisma.catalogItem.findFirst({ where: { isActive: true, stockQuantity: { gte: 5 } } });
    if (!item) throw new Error('Seeded catalog item with sufficient stock not found');
    const stockBeforeOrder = item.stockQuantity;
    const orderQty = 2;

    // Place a fresh SUBMITTED order for Customer 1 (deducts stock by 2)
    const createRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({ items: [{ catalogItemId: item.id, quantity: orderQty }] });
    expect(createRes.status).toBe(201);
    const targetOrderId = createRes.body.data.id;

    const itemAfterOrder = await prisma.catalogItem.findUnique({ where: { id: item.id } });
    expect(itemAfterOrder!.stockQuantity).toBe(stockBeforeOrder - orderQty);

    // Cancel own SUBMITTED order
    const cancelRes = await request(app)
      .patch(`/api/orders/${targetOrderId}/cancel`)
      .set('Authorization', `Bearer ${customer1Token}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.success).toBe(true);
    expect(cancelRes.body.data.id).toBe(targetOrderId);
    expect(cancelRes.body.data.status).toBe(OrderStatus.CANCELLED);

    // Verify PostgreSQL order status and restored stock
    const dbOrder = await prisma.order.findUnique({ where: { id: targetOrderId } });
    expect(dbOrder!.status).toBe(OrderStatus.CANCELLED);

    const itemAfterCancel = await prisma.catalogItem.findUnique({ where: { id: item.id } });
    expect(itemAfterCancel!.stockQuantity).toBe(stockBeforeOrder);

    // Preserved BR-06 guard: Operator cannot accept a CANCELLED order (409 Conflict)
    const acceptRes = await request(app)
      .patch(`/api/operator/orders/${targetOrderId}/accept`)
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(acceptRes.status).toBe(409);
  });

  // TEST-17 / AC-15: Cannot cancel ACCEPTED or already CANCELLED order -> 409 ORDER_NOT_CANCELLABLE
  it('[TEST-17 / AC-15] PATCH /api/orders/:id/cancel returns 409 ORDER_NOT_CANCELLABLE for ACCEPTED or CANCELLED orders', async () => {
    const item = await prisma.catalogItem.findFirst({ where: { isActive: true, stockQuantity: { gte: 5 } } });
    if (!item) throw new Error('Seeded catalog item with sufficient stock not found');

    // Create order and have Operator accept it
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({ items: [{ catalogItemId: item.id, quantity: 1 }] });
    expect(orderRes.status).toBe(201);
    const acceptedOrderId = orderRes.body.data.id;

    const acceptRes = await request(app)
      .patch(`/api/operator/orders/${acceptedOrderId}/accept`)
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(acceptRes.status).toBe(200);

    const stockBeforeAttempt = (await prisma.catalogItem.findUnique({ where: { id: item.id } }))!.stockQuantity;

    // Attempt to cancel ACCEPTED order -> 409 Conflict
    const cancelAcceptedRes = await request(app)
      .patch(`/api/orders/${acceptedOrderId}/cancel`)
      .set('Authorization', `Bearer ${customer1Token}`);

    expect(cancelAcceptedRes.status).toBe(409);
    expect(cancelAcceptedRes.body.success).toBe(false);
    expect(cancelAcceptedRes.body.error.code).toBe('ORDER_NOT_CANCELLABLE');

    const stockAfterAcceptedAttempt = (await prisma.catalogItem.findUnique({ where: { id: item.id } }))!.stockQuantity;
    expect(stockAfterAcceptedAttempt).toBe(stockBeforeAttempt);

    // Also create and cancel an order once, then re-cancel -> 409 Conflict (no double stock restore!)
    const order2Res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({ items: [{ catalogItemId: item.id, quantity: 1 }] });
    const cancelledOrderId = order2Res.body.data.id;

    const firstCancel = await request(app)
      .patch(`/api/orders/${cancelledOrderId}/cancel`)
      .set('Authorization', `Bearer ${customer1Token}`);
    expect(firstCancel.status).toBe(200);

    const stockAfterFirstCancel = (await prisma.catalogItem.findUnique({ where: { id: item.id } }))!.stockQuantity;
    const secondCancel = await request(app)
      .patch(`/api/orders/${cancelledOrderId}/cancel`)
      .set('Authorization', `Bearer ${customer1Token}`);

    expect(secondCancel.status).toBe(409);
    expect(secondCancel.body.success).toBe(false);
    expect(secondCancel.body.error.code).toBe('ORDER_NOT_CANCELLABLE');
    expect((await prisma.catalogItem.findUnique({ where: { id: item.id } }))!.stockQuantity).toBe(stockAfterFirstCancel);
  });

  // TEST-18 / AC-16: Non-owning CUSTOMER, OPERATOR (403), unauthenticated (401), and unknown ID (404)
  it('[TEST-18 / AC-16] PATCH /api/orders/:id/cancel enforces ownership, CUSTOMER-only role (403), auth (401), and existence (404)', async () => {
    const item = await prisma.catalogItem.findFirst({ where: { isActive: true, stockQuantity: { gte: 5 } } });
    if (!item) throw new Error('Seeded catalog item with sufficient stock not found');

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({ items: [{ catalogItemId: item.id, quantity: 1 }] });
    expect(orderRes.status).toBe(201);
    const targetOrderId = orderRes.body.data.id;
    const stockBefore = (await prisma.catalogItem.findUnique({ where: { id: item.id } }))!.stockQuantity;

    // 1. Unauthenticated -> 401
    const unauthRes = await request(app).patch(`/api/orders/${targetOrderId}/cancel`);
    expect(unauthRes.status).toBe(401);

    // 2. Non-owning CUSTOMER (Customer 2) -> 403 Forbidden
    const otherCustRes = await request(app)
      .patch(`/api/orders/${targetOrderId}/cancel`)
      .set('Authorization', `Bearer ${customer2Token}`);
    expect(otherCustRes.status).toBe(403);
    expect(otherCustRes.body.success).toBe(false);

    // 3. OPERATOR role -> 403 Forbidden
    const opRes = await request(app)
      .patch(`/api/orders/${targetOrderId}/cancel`)
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(opRes.status).toBe(403);
    expect(opRes.body.success).toBe(false);

    // 4. Unknown order ID -> 404 Not Found
    const notFoundRes = await request(app)
      .patch('/api/orders/999999/cancel')
      .set('Authorization', `Bearer ${customer1Token}`);
    expect(notFoundRes.status).toBe(404);

    // Verify order stays SUBMITTED and stock stays unchanged
    const dbOrder = await prisma.order.findUnique({ where: { id: targetOrderId } });
    expect(dbOrder!.status).toBe(OrderStatus.SUBMITTED);
    expect((await prisma.catalogItem.findUnique({ where: { id: item.id } }))!.stockQuantity).toBe(stockBefore);
  });
});
