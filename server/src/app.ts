import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth.js';
import { catalogRouter } from './routes/catalog.js';
import { ordersRouter } from './routes/orders.js';
import { operatorRouter } from './routes/operator.js';

dotenv.config();

export const app = express();

app.use(cors());
app.use(express.json());

// Baseline health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'QuickOrder API',
    timestamp: new Date().toISOString()
  });
});

// Authentication routes
app.use('/api/auth', authRouter);

// Catalog routes (Public / Customers)
app.use('/api/catalog', catalogRouter);

// Orders routes (Customer order creation & tracking)
app.use('/api/orders', ordersRouter);

// Operator routes (Operator Queue & State Transitions)
app.use('/api/operator', operatorRouter);
