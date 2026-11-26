import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { OrderStatus, PaymentStatus, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { prisma } from '../src/prisma.js';

describe('Feature F-08: Simulated Payment Processing Lifecycle API Tests', () => {
  let customer1Token: string;
  let customer2Token: string;
  let operatorToken: string;
  let catalogItemId: number;

  beforeAll(async () => {
    await prisma.$connect();

    const login1 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer1@example.com', password: 'Password123!' });
    customer1Token = login1.body.data.token;

    const passwordHash = await bcrypt.hash('Password123!', 10);
    await prisma.user.upsert({
      where: { email: 'customer2@example.com' },
      update: {},
      create: {
        email: 'customer2@example.com',
        passwordHash,
        fullName: 'Bob SecondCustomer',
        role: Role.CUSTOMER
      }
    });
    const login2 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer2@example.com', password: 'Password123!' });
    customer2Token = login2.body.data.token;

    const loginOp = await request(app)
      .post('/api/auth/login')
      .send({ email: 'operator1@example.com', password: 'Password123!' });
    operatorToken = loginOp.body.data.token;

    const item = await prisma.catalogItem.findFirst({ where: { isActive: true, stockQuantity: { gte: 10 } } });
    if (!item) throw new Error('Seeded catalog item with sufficient stock not found');
    catalogItemId = item.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // TEST-S2-09 / AC-S2-09 & AC-S2-10: New order starts UNPAID; owner pays active UNPAID order
  it('[TEST-S2-09 / AC-S2-09, AC-S2-10] initializes orders as UNPAID and allows owning CUSTOMER to pay via POST /api/orders/:id/pay', async () => {
    const createRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({ items: [{ catalogItemId, quantity: 1 }] });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.paymentStatus).toBe(PaymentStatus.UNPAID);
    expect(createRes.body.data.paymentReference).toBeNull();
    expect(createRes.body.data.paidAt).toBeNull();

    const orderId = createRes.body.data.id;
    const expectedTotal = createRes.body.data.totalAmount;

    // Owner pays order (even sending tampered amount in body, server uses authoritative total)
    const payRes = await request(app)
      .post(`/api/orders/${orderId}/pay`)
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({ amount: 0.01 });

    expect(payRes.status).toBe(200);
    expect(payRes.body.success).toBe(true);
    expect(payRes.body.data.id).toBe(orderId);
    expect(payRes.body.data.paymentStatus).toBe(PaymentStatus.PAID);
    expect(payRes.body.data.paymentReference).toMatch(new RegExp(`^PAY-${orderId}-`));
    expect(payRes.body.data.paidAt).toBeTruthy();
    expect(payRes.body.data.totalAmount).toBe(expectedTotal);

    const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
    expect(dbOrder!.paymentStatus).toBe(PaymentStatus.PAID);
    expect(dbOrder!.paymentReference).toBe(payRes.body.data.paymentReference);
    expect(dbOrder!.paidAt).not.toBeNull();

    // Also verify ACCEPTED + UNPAID order can be paid
    const acceptedOrderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({ items: [{ catalogItemId, quantity: 1 }] });
    const acceptedOrderId = acceptedOrderRes.body.data.id;

    await request(app)
      .patch(`/api/operator/orders/${acceptedOrderId}/accept`)
      .set('Authorization', `Bearer ${operatorToken}`);

    const payAcceptedRes = await request(app)
      .post(`/api/orders/${acceptedOrderId}/pay`)
      .set('Authorization', `Bearer ${customer1Token}`);
    expect(payAcceptedRes.status).toBe(200);
    expect(payAcceptedRes.body.data.status).toBe(OrderStatus.ACCEPTED);
    expect(payAcceptedRes.body.data.paymentStatus).toBe(PaymentStatus.PAID);
  });

  // TEST-S2-10 / AC-S2-11: Paying already PAID, CANCELLED, or REJECTED order -> 409 ORDER_NOT_PAYABLE
  it('[TEST-S2-10 / AC-S2-11] POST /api/orders/:id/pay rejects PAID, CANCELLED, or REJECTED orders with 409 ORDER_NOT_PAYABLE', async () => {
    // 1. Already PAID order
    const order1 = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({ items: [{ catalogItemId, quantity: 1 }] });
    const paidOrderId = order1.body.data.id;

    const firstPay = await request(app)
      .post(`/api/orders/${paidOrderId}/pay`)
      .set('Authorization', `Bearer ${customer1Token}`);
    expect(firstPay.status).toBe(200);

    const doublePay = await request(app)
      .post(`/api/orders/${paidOrderId}/pay`)
      .set('Authorization', `Bearer ${customer1Token}`);
    expect(doublePay.status).toBe(409);
    expect(doublePay.body.success).toBe(false);
    expect(doublePay.body.error.code).toBe('ORDER_NOT_PAYABLE');

    // 2. CANCELLED order
    const order2 = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({ items: [{ catalogItemId, quantity: 1 }] });
    const cancelledOrderId = order2.body.data.id;

    await request(app)
      .patch(`/api/orders/${cancelledOrderId}/cancel`)
      .set('Authorization', `Bearer ${customer1Token}`);

    const payCancelled = await request(app)
      .post(`/api/orders/${cancelledOrderId}/pay`)
      .set('Authorization', `Bearer ${customer1Token}`);
    expect(payCancelled.status).toBe(409);
    expect(payCancelled.body.error.code).toBe('ORDER_NOT_PAYABLE');

    // 3. REJECTED order
    const order3 = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({ items: [{ catalogItemId, quantity: 1 }] });
    const rejectedOrderId = order3.body.data.id;

    await request(app)
      .patch(`/api/operator/orders/${rejectedOrderId}/reject`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ reason: 'Out of stock' });

    const payRejected = await request(app)
      .post(`/api/orders/${rejectedOrderId}/pay`)
      .set('Authorization', `Bearer ${customer1Token}`);
    expect(payRejected.status).toBe(409);
    expect(payRejected.body.error.code).toBe('ORDER_NOT_PAYABLE');
  });

  // TEST-S2-11 / AC-S2-12: Non-owning CUSTOMER or OPERATOR -> 403; unauth -> 401; unknown -> 404
  it('[TEST-S2-11 / AC-S2-12] POST /api/orders/:id/pay enforces owner CUSTOMER access (403), auth (401), and 404', async () => {
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({ items: [{ catalogItemId, quantity: 1 }] });
    const orderId = orderRes.body.data.id;

    const unauthRes = await request(app).post(`/api/orders/${orderId}/pay`);
    expect(unauthRes.status).toBe(401);

    const otherCustRes = await request(app)
      .post(`/api/orders/${orderId}/pay`)
      .set('Authorization', `Bearer ${customer2Token}`);
    expect(otherCustRes.status).toBe(403);
    expect(otherCustRes.body.success).toBe(false);

    const opRes = await request(app)
      .post(`/api/orders/${orderId}/pay`)
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(opRes.status).toBe(403);
    expect(opRes.body.success).toBe(false);

    const notFoundRes = await request(app)
      .post('/api/orders/999999/pay')
      .set('Authorization', `Bearer ${customer1Token}`);
    expect(notFoundRes.status).toBe(404);

    const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
    expect(dbOrder!.paymentStatus).toBe(PaymentStatus.UNPAID);
  });

  // TEST-S2-12 / AC-S2-12 & F-07: Cancelling or rejecting a PAID order atomically sets REFUNDED & restores stock
  it('[TEST-S2-12 / AC-S2-12] cancelling or rejecting a PAID order atomically transitions paymentStatus to REFUNDED and restores stock', async () => {
    const initialStock = (await prisma.catalogItem.findUnique({ where: { id: catalogItemId } }))!.stockQuantity;

    // A. Customer pays then cancels
    const orderARes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({ items: [{ catalogItemId, quantity: 2 }] });
    const orderAId = orderARes.body.data.id;

    const payARes = await request(app)
      .post(`/api/orders/${orderAId}/pay`)
      .set('Authorization', `Bearer ${customer1Token}`);
    expect(payARes.status).toBe(200);

    const cancelARes = await request(app)
      .patch(`/api/orders/${orderAId}/cancel`)
      .set('Authorization', `Bearer ${customer1Token}`);
    expect(cancelARes.status).toBe(200);
    expect(cancelARes.body.data.status).toBe(OrderStatus.CANCELLED);
    expect(cancelARes.body.data.paymentStatus).toBe(PaymentStatus.REFUNDED);

    expect((await prisma.catalogItem.findUnique({ where: { id: catalogItemId } }))!.stockQuantity).toBe(initialStock);

    // Paying a REFUNDED order must also return 409 ORDER_NOT_PAYABLE
    const payRefundedRes = await request(app)
      .post(`/api/orders/${orderAId}/pay`)
      .set('Authorization', `Bearer ${customer1Token}`);
    expect(payRefundedRes.status).toBe(409);
    expect(payRefundedRes.body.error.code).toBe('ORDER_NOT_PAYABLE');

    // B. Customer pays then Operator rejects
    const orderBRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({ items: [{ catalogItemId, quantity: 2 }] });
    const orderBId = orderBRes.body.data.id;

    const payBRes = await request(app)
      .post(`/api/orders/${orderBId}/pay`)
      .set('Authorization', `Bearer ${customer1Token}`);
    expect(payBRes.status).toBe(200);

    const rejectBRes = await request(app)
      .patch(`/api/operator/orders/${orderBId}/reject`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ reason: 'Machine maintenance' });
    expect(rejectBRes.status).toBe(200);
    expect(rejectBRes.body.data.status).toBe(OrderStatus.REJECTED);
    expect(rejectBRes.body.data.paymentStatus).toBe(PaymentStatus.REFUNDED);

    expect((await prisma.catalogItem.findUnique({ where: { id: catalogItemId } }))!.stockQuantity).toBe(initialStock);
  });
});
