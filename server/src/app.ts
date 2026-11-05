import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Role } from '@prisma/client';
import { authRouter } from './routes/auth.js';
import { requireAuth, requireRole, AuthenticatedRequest } from './middleware/auth.js';

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

// Role guard test / placeholder operator route
app.get('/api/operator/orders', requireAuth, requireRole(Role.OPERATOR), (_req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({
    success: true,
    data: []
  });
});
