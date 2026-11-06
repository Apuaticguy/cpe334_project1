import { Router, Request, Response } from 'express';
import { prisma } from '../prisma.js';

export const catalogRouter = Router();

// GET /api/catalog - List all active catalog items
catalogRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const items = await prisma.catalogItem.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' }
    });

    const data = items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      unitPrice: Number(item.unitPrice).toFixed(2),
      stockQuantity: item.stockQuantity,
      isActive: item.isActive,
    }));

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching catalog items:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve catalog items' }
    });
  }
});
