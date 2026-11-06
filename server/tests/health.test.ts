import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('API Health Check Baseline', () => {
  it('GET /api/health returns 200 OK and service metadata', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('QuickOrder API');
    expect(res.body.timestamp).toBeDefined();
  });
});
