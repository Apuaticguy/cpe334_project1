import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/prisma.js';

describe('Feature 2: Catalog Browsing API Tests', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // TEST-05: Catalog Listing with Authoritative Prices
  it('[TEST-05 / AC-05] GET /api/catalog returns active catalog items with authoritative prices', async () => {
    const res = await request(app).get('/api/catalog');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const firstItem = res.body.data[0];
    expect(firstItem.id).toBeDefined();
    expect(firstItem.name).toBeDefined();
    expect(firstItem.unitPrice).toBeDefined();
    expect(typeof firstItem.unitPrice).toBe('string');
    expect(firstItem.stockQuantity).toBeGreaterThanOrEqual(0);
    expect(firstItem.isActive).toBe(true);
  });
});
