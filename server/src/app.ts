import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { prisma } from './prisma.js';
import { authRouter } from './routes/auth.js';
import { catalogRouter } from './routes/catalog.js';
import { ordersRouter } from './routes/orders.js';
import { operatorRouter } from './routes/operator.js';

dotenv.config();

export const app = express();

app.use(cors());
app.use(express.json());

// Baseline liveness probe
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'QuickOrder API',
    timestamp: new Date().toISOString()
  });
});

// Database readiness probe for Cloud Run / smoke tests
app.get('/api/ready', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready', db: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'not_ready', db: 'disconnected' });
  }
});

// Authentication routes
app.use('/api/auth', authRouter);

// Catalog routes (Public / Customers)
app.use('/api/catalog', catalogRouter);

// Orders routes (Customer order creation & tracking)
app.use('/api/orders', ordersRouter);

// Operator routes (Operator Queue & State Transitions)
app.use('/api/operator', operatorRouter);

// Serve built React SPA static assets in production
const candidateDistPaths = [
  path.resolve(process.cwd(), '../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
  '/app/client/dist',
];
const clientDist = candidateDistPaths.find((p) => fs.existsSync(p));

if (clientDist) {
  app.use(express.static(clientDist));
  app.get('*', (req: Request, res: Response, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}


