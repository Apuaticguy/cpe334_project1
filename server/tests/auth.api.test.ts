import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/prisma.js';

describe('Feature 1: Authentication & Role Authorization API Tests', () => {
  beforeAll(async () => {
    // Ensure database connection is active
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // TEST-01: Valid Login for Customer
  it('[TEST-01 / AC-01] POST /api/auth/login with valid credentials returns 200 OK, token, and user info', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'customer1@example.com',
        password: 'Password123!'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.user.email).toBe('customer1@example.com');
    expect(res.body.data.user.role).toBe('CUSTOMER');
    expect(res.body.data.user.passwordHash).toBeUndefined(); // Plaintext/hash never exposed
  });

  // TEST-02: Invalid Password
  it('[TEST-02 / AC-02] POST /api/auth/login with wrong password returns 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'customer1@example.com',
        password: 'WrongPassword999!'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/invalid email or password/i);
  });

  // TEST-03: Non-existent User
  it('[TEST-03 / AC-02] POST /api/auth/login with non-existent email returns 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'ghost_user@example.com',
        password: 'Password123!'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/invalid email or password/i);
  });

  // TEST-04: Unauthenticated access to /api/auth/me
  it('[TEST-04 / AC-03] GET /api/auth/me without token returns 401 Unauthorized', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  // TEST-05: Authenticated access to /api/auth/me
  it('[TEST-05 / AC-01] GET /api/auth/me with valid Bearer token returns current user profile', async () => {
    // Login first to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'customer1@example.com',
        password: 'Password123!'
      });

    const token = loginRes.body.data.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.email).toBe('customer1@example.com');
    expect(meRes.body.data.role).toBe('CUSTOMER');
  });

  // TEST-06: Forbidden Role check - Customer accessing Operator endpoint
  it('[TEST-06 / AC-04] Customer attempting to access operator endpoint returns 403 Forbidden', async () => {
    const customerLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'customer1@example.com',
        password: 'Password123!'
      });

    const customerToken = customerLogin.body.data.token;

    const res = await request(app)
      .get('/api/operator/orders')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // TEST-07: Allowed Role check - Operator accessing Operator endpoint
  it('[TEST-07 / AC-04] Operator accessing operator endpoint returns 200 OK', async () => {
    const operatorLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'operator1@example.com',
        password: 'Password123!'
      });

    const operatorToken = operatorLogin.body.data.token;

    const res = await request(app)
      .get('/api/operator/orders')
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // TEST-08: Logout
  it('[TEST-08 / AC-08] POST /api/auth/logout with token returns 200 OK', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'customer1@example.com',
        password: 'Password123!'
      });

    const token = loginRes.body.data.token;

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);
  });
});
