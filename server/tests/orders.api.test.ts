import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/prisma.js';

describe('Feature 2 & 3: Order Placement & Authoritative Pricing API Tests', () => {
  let customerToken: string;
  let testCatalogItem1: { id: number; name: string; unitPrice: number; stockQuantity: number };
  let testCatalogItem2: { id: number; name: string; unitPrice: number; stockQuantity: number };

  beforeAll(async () => {
    await prisma.$connect();

    // Authenticate as Customer
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'customer1@example.com',
        password: 'Password123!'
      });

    customerToken = loginRes.body.data.token;

    // Fetch existing catalog items from seed
    const items = await prisma.catalogItem.findMany({
      where: { isActive: true },
      take: 2,
    });

    testCatalogItem1 = {
      id: items[0].id,
      name: items[0].name,
      unitPrice: Number(items[0].unitPrice),
      stockQuantity: items[0].stockQuantity,
    };

    testCatalogItem2 = {
      id: items[1].id,
      name: items[1].name,
      unitPrice: Number(items[1].unitPrice),
      stockQuantity: items[1].stockQuantity,
    };
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // TEST-06: Valid Order Creation with Server-authoritative Pricing
  it('[TEST-06 / AC-06] POST /api/orders computes authoritative total, ignores client-tampered prices, and persists order', async () => {
    const qty1 = 2;
    const qty2 = 1;
    const expectedTotal = (testCatalogItem1.unitPrice * qty1 + testCatalogItem2.unitPrice * qty2).toFixed(2);

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        totalAmount: '0.01', // Client attempts tampering with total amount
        items: [
          { catalogItemId: testCatalogItem1.id, quantity: qty1, unitPrice: '0.01' },
          { catalogItemId: testCatalogItem2.id, quantity: qty2, unitPrice: '0.01' }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.status).toBe('SUBMITTED');
    expect(res.body.data.totalAmount).toBe(expectedTotal); // Server must enforce true total!
    expect(res.body.data.items).toHaveLength(2);

    // Verify snapshots were saved in database
    const savedOrder = await prisma.order.findUnique({
      where: { id: res.body.data.id },
      include: { items: true }
    });

    expect(savedOrder).not.toBeNull();
    expect(Number(savedOrder!.totalAmount)).toBe(Number(expectedTotal));
    expect(savedOrder!.items[0].itemNameSnapshot).toBe(testCatalogItem1.name);
    expect(Number(savedOrder!.items[0].unitPriceSnapshot)).toBe(testCatalogItem1.unitPrice);
  });

  // TEST-07: Invalid / Non-positive Quantity Validation
  it('[TEST-07 / AC-07] POST /api/orders rejects zero or negative quantities with 400 Bad Request', async () => {
    const resNegative = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ catalogItemId: testCatalogItem1.id, quantity: -1 }]
      });

    expect(resNegative.status).toBe(400);
    expect(resNegative.body.success).toBe(false);

    const resZero = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ catalogItemId: testCatalogItem1.id, quantity: 0 }]
      });

    expect(resZero.status).toBe(400);
    expect(resZero.body.success).toBe(false);

    const resEmpty = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: []
      });

    expect(resEmpty.status).toBe(400);
    expect(resEmpty.body.success).toBe(false);
  });

  // TEST-08: Stock Availability Validation
  it('[TEST-08 / AC-08] POST /api/orders rejects orders exceeding stock with 422 Unprocessable Entity', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [{ catalogItemId: testCatalogItem1.id, quantity: 999999 }]
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/insufficient stock/i);
  });

  // Security test: Unauthenticated Order Creation
  it('[SECURITY / AC-03] POST /api/orders without token returns 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ catalogItemId: testCatalogItem1.id, quantity: 1 }]
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
