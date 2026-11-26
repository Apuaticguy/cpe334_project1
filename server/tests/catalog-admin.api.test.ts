import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/prisma.js';

describe('Feature F-06: Catalog & Inventory Administration API Tests', () => {
  let operatorToken: string;
  let customerToken: string;
  let createdItemId: number;

  beforeAll(async () => {
    await prisma.$connect();

    const opLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'operator1@example.com', password: 'Password123!' });
    operatorToken = opLogin.body.data.token;

    const custLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer1@example.com', password: 'Password123!' });
    customerToken = custLogin.body.data.token;
  });

  afterAll(async () => {
    if (createdItemId) {
      await prisma.orderItem.deleteMany({ where: { catalogItemId: createdItemId } });
      await prisma.catalogItem.deleteMany({ where: { id: createdItemId } });
    }
    await prisma.$disconnect();
  });

  // TEST-S2-01 / AC-S2-01: Operator creates new catalog item
  it('[TEST-S2-01 / AC-S2-01] POST /api/operator/catalog creates a new active item (201) visible in GET /api/catalog', async () => {
    const res = await request(app)
      .post('/api/operator/catalog')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        name: 'Thai Iced Tea Special',
        description: 'Rich brewed tea with condensed milk',
        unitPrice: 4.75,
        stockQuantity: 20,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Thai Iced Tea Special');
    expect(res.body.data.unitPrice).toBe('4.75');
    expect(res.body.data.stockQuantity).toBe(20);
    expect(res.body.data.isActive).toBe(true);

    createdItemId = res.body.data.id;

    // Verify public catalog reflects created item
    const catRes = await request(app).get('/api/catalog');
    expect(catRes.status).toBe(200);
    const found = catRes.body.data.find((i: any) => i.id === createdItemId);
    expect(found).toBeDefined();
    expect(found.unitPrice).toBe('4.75');
  });

  // TEST-S2-02 / AC-S2-02: Update price & stock while preserving historical OrderItem.unitPriceSnapshot
  it('[TEST-S2-02 / AC-S2-02] PATCH /api/operator/catalog/:id updates price/stock and preserves historical OrderItem snapshots', async () => {
    // Customer places order at initial price $4.75
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ catalogItemId: createdItemId, quantity: 2 }] });
    expect(orderRes.status).toBe(201);
    const historicalOrderId = orderRes.body.data.id;

    // Operator updates price to $6.25 and stock to 35
    const patchRes = await request(app)
      .patch(`/api/operator/catalog/${createdItemId}`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ unitPrice: 6.25, stockQuantity: 35 });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.success).toBe(true);
    expect(patchRes.body.data.unitPrice).toBe('6.25');
    expect(patchRes.body.data.stockQuantity).toBe(35);

    // Historical order MUST retain original snapshot price ($4.75) and total ($9.50)
    const histRes = await request(app)
      .get(`/api/orders/${historicalOrderId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(histRes.status).toBe(200);
    expect(histRes.body.data.totalAmount).toBe('9.50');
    expect(histRes.body.data.items[0].unitPrice).toBe('4.75');

    // Also verify deactivating hides item from public GET /api/catalog
    const deactivateRes = await request(app)
      .patch(`/api/operator/catalog/${createdItemId}`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ isActive: false });
    expect(deactivateRes.status).toBe(200);
    expect(deactivateRes.body.data.isActive).toBe(false);

    const publicCatalog = await request(app).get('/api/catalog');
    expect(publicCatalog.body.data.find((i: any) => i.id === createdItemId)).toBeUndefined();
  });

  // TEST-S2-03 / AC-S2-03: Validation boundaries (400 Bad Request, 404 Not Found)
  it('[TEST-S2-03 / AC-S2-03] rejects invalid unitPrice <= 0, stockQuantity < 0, empty name (400), and unknown ID (404)', async () => {
    const negPrice = await request(app)
      .post('/api/operator/catalog')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ name: 'Bad Item', description: 'Invalid price', unitPrice: -5, stockQuantity: 10 });
    expect(negPrice.status).toBe(400);

    const negStock = await request(app)
      .patch(`/api/operator/catalog/${createdItemId}`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ stockQuantity: -1 });
    expect(negStock.status).toBe(400);

    const emptyName = await request(app)
      .post('/api/operator/catalog')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ name: '   ', description: 'Blank name', unitPrice: 3.0, stockQuantity: 5 });
    expect(emptyName.status).toBe(400);

    const notFound = await request(app)
      .patch('/api/operator/catalog/999999')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ unitPrice: 5.0 });
    expect(notFound.status).toBe(404);
  });

  // TEST-S2-04 / AC-S2-04: Security boundaries (401 Unauthorized, 403 Forbidden for CUSTOMER)
  it('[TEST-S2-04 / AC-S2-04] rejects CUSTOMER role (403) and unauthenticated requests (401)', async () => {
    const unauthPost = await request(app)
      .post('/api/operator/catalog')
      .send({ name: 'Hacker Item', description: 'No auth', unitPrice: 1.0, stockQuantity: 1 });
    expect(unauthPost.status).toBe(401);

    const custPost = await request(app)
      .post('/api/operator/catalog')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Customer Item', description: 'Forbidden', unitPrice: 1.0, stockQuantity: 1 });
    expect(custPost.status).toBe(403);

    const custPatch = await request(app)
      .patch(`/api/operator/catalog/${createdItemId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ unitPrice: 0.01 });
    expect(custPatch.status).toBe(403);
  });
});
