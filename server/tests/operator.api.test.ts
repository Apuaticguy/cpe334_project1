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
});
