import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { OrderStatus } from '@prisma/client';
import { app } from '../src/app.js';
import { prisma } from '../src/prisma.js';

describe('Feature 4: Operator Order Queue & State Acceptance API Tests', () => {
  let operatorToken: string;
  let customerToken: string;
  let testOrderId: number;

  beforeAll(async () => {
    await prisma.$connect();

    // Authenticate Operator
    const opLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'operator1@example.com',
        password: 'Password123!'
      });
    operatorToken = opLogin.body.data.token;

    // Authenticate Customer
    const custLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'customer1@example.com',
        password: 'Password123!'
      });
    customerToken = custLogin.body.data.token;

    // Create a fresh test order for state transition testing
    const item = await prisma.catalogItem.findFirst({ where: { isActive: true, stockQuantity: { gt: 5 } } });
    if (!item) throw new Error('No active catalog item found with sufficient stock for testing');

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ catalogItemId: item.id, quantity: 1 }]
      });

    testOrderId = orderRes.body.data.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // TEST-11: Operator Order Queue Listing
  it('[TEST-11 / AC-11] GET /api/operator/orders returns all orders with customer details for Operator', async () => {
    const res = await request(app)
      .get('/api/operator/orders')
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const targetOrder = res.body.data.find((o: any) => o.id === testOrderId);
    expect(targetOrder).toBeDefined();
    expect(targetOrder.customer).toBeDefined();
    expect(targetOrder.customer.email).toBe('customer1@example.com');
    expect(targetOrder.items).toBeDefined();
    expect(targetOrder.items.length).toBeGreaterThan(0);
  });

  // TEST-12: Valid State Transition (SUBMITTED -> ACCEPTED)
  it('[TEST-12 / AC-12] PATCH /api/operator/orders/:id/accept transitions SUBMITTED order to ACCEPTED', async () => {
    const res = await request(app)
      .patch(`/api/operator/orders/${testOrderId}/accept`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(testOrderId);
    expect(res.body.data.status).toBe(OrderStatus.ACCEPTED);

    // Verify database record has updated status
    const dbOrder = await prisma.order.findUnique({ where: { id: testOrderId } });
    expect(dbOrder!.status).toBe(OrderStatus.ACCEPTED);
  });

  // TEST-13: Invalid Transition / Conflict (Already ACCEPTED)
  it('[TEST-13 / AC-13] PATCH /api/operator/orders/:id/accept on already ACCEPTED order returns 409 Conflict', async () => {
    const res = await request(app)
      .patch(`/api/operator/orders/${testOrderId}/accept`)
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/cannot accept.*already accepted/i);
  });

  // Non-existent order
  it('PATCH /api/operator/orders/:id/accept on non-existent order returns 404 Not Found', async () => {
    const res = await request(app)
      .patch('/api/operator/orders/999999/accept')
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // Role Restriction: Customer is Forbidden
  it('[SECURITY / AC-04] Customer role cannot access GET or PATCH operator endpoints (403 Forbidden)', async () => {
    const getRes = await request(app)
      .get('/api/operator/orders')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(getRes.status).toBe(403);
    expect(getRes.body.success).toBe(false);

    const patchRes = await request(app)
      .patch(`/api/operator/orders/${testOrderId}/accept`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(patchRes.status).toBe(403);
    expect(patchRes.body.success).toBe(false);
  });

  // Unauthenticated access returns 401
  it('[SECURITY / AC-03] Unauthenticated requests to operator endpoints return 401 Unauthorized', async () => {
    const getRes = await request(app).get('/api/operator/orders');
    expect(getRes.status).toBe(401);

    const patchRes = await request(app).patch(`/api/operator/orders/${testOrderId}/accept`);
    expect(patchRes.status).toBe(401);
  });

  // ---------------------------------------------------------------------------
  // Sprint 2 F-07 (Issue #38): Operator Order Rejection & Atomic Stock Restore
  // ---------------------------------------------------------------------------

  // TEST-S2-05 / AC-S2-05: Operator rejects SUBMITTED order with reason -> 200 REJECTED + stock restored
  it('[TEST-S2-05 / AC-S2-05] PATCH /api/operator/orders/:id/reject rejects SUBMITTED order with reason and restores stock atomically', async () => {
    const item = await prisma.catalogItem.findFirst({ where: { isActive: true, stockQuantity: { gte: 5 } } });
    if (!item) throw new Error('Seeded catalog item with sufficient stock not found');
    const initialStock = item.stockQuantity;
    const qty = 2;

    const createRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ catalogItemId: item.id, quantity: qty }] });
    expect(createRes.status).toBe(201);
    const orderId = createRes.body.data.id;

    expect((await prisma.catalogItem.findUnique({ where: { id: item.id } }))!.stockQuantity).toBe(initialStock - qty);

    const rejectRes = await request(app)
      .patch(`/api/operator/orders/${orderId}/reject`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ reason: '  Out of cups  ' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.success).toBe(true);
    expect(rejectRes.body.data.id).toBe(orderId);
    expect(rejectRes.body.data.status).toBe(OrderStatus.REJECTED);
    expect(rejectRes.body.data.rejectionReason).toBe('Out of cups');

    const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
    expect(dbOrder!.status).toBe(OrderStatus.REJECTED);
    expect(dbOrder!.rejectionReason).toBe('Out of cups');

    const restoredStock = (await prisma.catalogItem.findUnique({ where: { id: item.id } }))!.stockQuantity;
    expect(restoredStock).toBe(initialStock);

    // Customer GET /api/orders/:id reflects rejectionReason
    const detailRes = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.status).toBe(OrderStatus.REJECTED);
    expect(detailRes.body.data.rejectionReason).toBe('Out of cups');

    // Operator cannot accept a REJECTED order (BR-06 -> 409)
    const acceptRejectedRes = await request(app)
      .patch(`/api/operator/orders/${orderId}/accept`)
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(acceptRejectedRes.status).toBe(409);
  });

  // TEST-S2-06 / AC-S2-06: Missing or whitespace-only reason -> 400 INVALID_INPUT
  it('[TEST-S2-06 / AC-S2-06] PATCH /api/operator/orders/:id/reject rejects blank or missing reason with 400 INVALID_INPUT', async () => {
    const item = await prisma.catalogItem.findFirst({ where: { isActive: true, stockQuantity: { gte: 5 } } });
    if (!item) throw new Error('Seeded catalog item with sufficient stock not found');

    const createRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ catalogItemId: item.id, quantity: 1 }] });
    const orderId = createRes.body.data.id;
    const stockBefore = (await prisma.catalogItem.findUnique({ where: { id: item.id } }))!.stockQuantity;

    const blankRes = await request(app)
      .patch(`/api/operator/orders/${orderId}/reject`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ reason: '   ' });

    expect(blankRes.status).toBe(400);
    expect(blankRes.body.success).toBe(false);
    expect(blankRes.body.error.code).toBe('INVALID_INPUT');

    const missingRes = await request(app)
      .patch(`/api/operator/orders/${orderId}/reject`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({});

    expect(missingRes.status).toBe(400);
    expect(missingRes.body.success).toBe(false);
    expect(missingRes.body.error.code).toBe('INVALID_INPUT');

    const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
    expect(dbOrder!.status).toBe(OrderStatus.SUBMITTED);
    expect((await prisma.catalogItem.findUnique({ where: { id: item.id } }))!.stockQuantity).toBe(stockBefore);
  });

  // TEST-S2-07 / AC-S2-07: Non-SUBMITTED order (ACCEPTED, CANCELLED, REJECTED) -> 409 STATE_CONFLICT
  it('[TEST-S2-07 / AC-S2-07] PATCH /api/operator/orders/:id/reject returns 409 STATE_CONFLICT for ACCEPTED, CANCELLED, or REJECTED orders', async () => {
    const item = await prisma.catalogItem.findFirst({ where: { isActive: true, stockQuantity: { gte: 5 } } });
    if (!item) throw new Error('Seeded catalog item with sufficient stock not found');

    // 1. Try rejecting already ACCEPTED testOrderId
    const stockBeforeAccepted = (await prisma.catalogItem.findUnique({ where: { id: item.id } }))!.stockQuantity;
    const acceptedRes = await request(app)
      .patch(`/api/operator/orders/${testOrderId}/reject`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ reason: 'Cannot reject accepted' });
    expect(acceptedRes.status).toBe(409);
    expect(acceptedRes.body.error.code).toBe('STATE_CONFLICT');
    expect((await prisma.catalogItem.findUnique({ where: { id: item.id } }))!.stockQuantity).toBe(stockBeforeAccepted);

    // 2. Create order, customer cancels, then operator tries to reject -> 409
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ catalogItemId: item.id, quantity: 1 }] });
    const cancelledId = orderRes.body.data.id;

    await request(app)
      .patch(`/api/orders/${cancelledId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`);

    const stockAfterCancel = (await prisma.catalogItem.findUnique({ where: { id: item.id } }))!.stockQuantity;
    const rejectCancelledRes = await request(app)
      .patch(`/api/operator/orders/${cancelledId}/reject`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ reason: 'Late reject' });

    expect(rejectCancelledRes.status).toBe(409);
    expect(rejectCancelledRes.body.error.code).toBe('STATE_CONFLICT');
    expect((await prisma.catalogItem.findUnique({ where: { id: item.id } }))!.stockQuantity).toBe(stockAfterCancel);
  });

  // TEST-S2-08 / AC-S2-08: CUSTOMER -> 403, unauthenticated -> 401, unknown ID -> 404
  it('[TEST-S2-08 / AC-S2-08] PATCH /api/operator/orders/:id/reject enforces OPERATOR role (403), auth (401), and 404', async () => {
    const item = await prisma.catalogItem.findFirst({ where: { isActive: true, stockQuantity: { gte: 5 } } });
    if (!item) throw new Error('Seeded catalog item with sufficient stock not found');

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ catalogItemId: item.id, quantity: 1 }] });
    const orderId = orderRes.body.data.id;

    const unauthRes = await request(app)
      .patch(`/api/operator/orders/${orderId}/reject`)
      .send({ reason: 'No auth' });
    expect(unauthRes.status).toBe(401);

    const custRes = await request(app)
      .patch(`/api/operator/orders/${orderId}/reject`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ reason: 'Customer forbidden' });
    expect(custRes.status).toBe(403);
    expect(custRes.body.success).toBe(false);

    const notFoundRes = await request(app)
      .patch('/api/operator/orders/999999/reject')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ reason: 'Missing order' });
    expect(notFoundRes.status).toBe(404);

    const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
    expect(dbOrder!.status).toBe(OrderStatus.SUBMITTED);
  });

  // ============================================================================
  // Sprint 3 Feature F-09: Order Fulfillment Lifecycle (ACCEPTED -> READY_FOR_PICKUP -> COMPLETED)
  // ============================================================================

  it('[TEST-S3-01 & TEST-S3-02 / AC-S3-01, AC-S3-02] transitions ACCEPTED -> READY_FOR_PICKUP -> COMPLETED and records timestamps', async () => {
    const item = await prisma.catalogItem.findFirst({ where: { isActive: true, stockQuantity: { gte: 5 } } });
    if (!item) throw new Error('Seeded catalog item with sufficient stock not found');

    // Create and accept an order
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ catalogItemId: item.id, quantity: 1 }] });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.data.id;

    const acceptRes = await request(app)
      .patch(`/api/operator/orders/${orderId}/accept`)
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.status).toBe('ACCEPTED');

    // TEST-S3-01: ACCEPTED -> READY_FOR_PICKUP
    const readyRes = await request(app)
      .patch(`/api/operator/orders/${orderId}/ready`)
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(readyRes.status).toBe(200);
    expect(readyRes.body.success).toBe(true);
    expect(readyRes.body.data.status).toBe('READY_FOR_PICKUP');
    expect(readyRes.body.data.readyAt).toBeTruthy();

    // TEST-S3-02: READY_FOR_PICKUP -> COMPLETED
    const completeRes = await request(app)
      .patch(`/api/operator/orders/${orderId}/complete`)
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.success).toBe(true);
    expect(completeRes.body.data.status).toBe('COMPLETED');
    expect(completeRes.body.data.readyAt).toBeTruthy();
    expect(completeRes.body.data.completedAt).toBeTruthy();

    // Verify customer sees READY/COMPLETED timestamps via GET /api/orders/:id
    const custOrder = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(custOrder.status).toBe(200);
    expect(custOrder.body.data.status).toBe('COMPLETED');
    expect(custOrder.body.data.completedAt).toBeTruthy();
  });

  it('[TEST-S3-03 / AC-S3-03] rejects skipped fulfillment state transitions (409) and CUSTOMER calls (403)', async () => {
    const item = await prisma.catalogItem.findFirst({ where: { isActive: true, stockQuantity: { gte: 5 } } });
    if (!item) throw new Error('Seeded catalog item with sufficient stock not found');

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ catalogItemId: item.id, quantity: 1 }] });
    const submittedOrderId = orderRes.body.data.id;

    // Cannot jump SUBMITTED -> READY_FOR_PICKUP (409)
    const skipReady = await request(app)
      .patch(`/api/operator/orders/${submittedOrderId}/ready`)
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(skipReady.status).toBe(409);

    // Cannot jump SUBMITTED -> COMPLETED (409)
    const skipComplete = await request(app)
      .patch(`/api/operator/orders/${submittedOrderId}/complete`)
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(skipComplete.status).toBe(409);

    // CUSTOMER forbidden from /ready and /complete (403)
    const custReady = await request(app)
      .patch(`/api/operator/orders/${submittedOrderId}/ready`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(custReady.status).toBe(403);

    const custComplete = await request(app)
      .patch(`/api/operator/orders/${submittedOrderId}/complete`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(custComplete.status).toBe(403);
  });
});
