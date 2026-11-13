import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/prisma.js';

describe('API Health and Readiness Probes', () => {
  it('GET /api/health returns 200 OK and service metadata', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('QuickOrder API');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /api/ready returns 200 OK when database is reachable', async () => {
    const querySpy = vi.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ '?column?': 1 }] as any);
    const res = await request(app).get('/api/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.db).toBe('connected');
    querySpy.mockRestore();
  });

  it('GET /api/ready returns 503 Service Unavailable when database query fails', async () => {
    const querySpy = vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('DB unreachable'));
    const res = await request(app).get('/api/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('not_ready');
    expect(res.body.db).toBe('disconnected');
    querySpy.mockRestore();
  });

  it('deliberate failure to verify merge gate blocks broken PR (Check C-02)', () => {
    expect('ci-gate-check').toBe('should-fail-to-block-merge');
  });
});

