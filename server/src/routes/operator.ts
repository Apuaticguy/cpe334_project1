import { Router, Response } from 'express';
import { Prisma, Role, OrderStatus } from '@prisma/client';
import { prisma } from '../prisma.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

export const operatorRouter = Router();

// Apply operator guard to all operator routes
operatorRouter.use(requireAuth, requireRole(Role.OPERATOR));

function formatCatalogItem(item: {
  id: number;
  name: string;
  description: string;
  unitPrice: Prisma.Decimal;
  stockQuantity: number;
  isActive: boolean;
}) {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    unitPrice: Number(item.unitPrice).toFixed(2),
    stockQuantity: item.stockQuantity,
    isActive: item.isActive,
  };
}

// GET /api/operator/orders - Retrieve all incoming orders for the operator queue
operatorRouter.get('/orders', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        items: true,
      },
    });

    const data = orders.map((order) => ({
      id: order.id,
      status: order.status,
      rejectionReason: order.rejectionReason,
      totalAmount: Number(order.totalAmount).toFixed(2),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      customer: {
        id: order.user.id,
        email: order.user.email,
        fullName: order.user.fullName,
      },
      items: order.items.map((item) => ({
        id: item.id,
        catalogItemId: item.catalogItemId,
        itemName: item.itemNameSnapshot,
        unitPrice: Number(item.unitPriceSnapshot).toFixed(2),
        quantity: item.quantity,
        lineTotal: Number(item.lineTotal).toFixed(2),
      })),
    }));

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching operator orders:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve operator orders' },
    });
  }
});

// PATCH /api/operator/orders/:id/accept - Transition order status from SUBMITTED to ACCEPTED
operatorRouter.patch('/orders/:id/accept', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId) || orderId <= 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid order ID' },
      });
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        items: true,
      },
    });

    if (!order) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Order #${orderId} not found` },
      });
      return;
    }

    // State transition business rule validation (BR-05, BR-06 / AC-13)
    if (order.status === OrderStatus.ACCEPTED) {
      res.status(409).json({
        success: false,
        error: {
          code: 'STATE_CONFLICT',
          message: `Cannot accept Order #${orderId} because it is already accepted`,
        },
      });
      return;
    }

    if (order.status === OrderStatus.CANCELLED) {
      res.status(409).json({
        success: false,
        error: {
          code: 'STATE_CONFLICT',
          message: `Cannot accept Order #${orderId} because it has been cancelled`,
        },
      });
      return;
    }

    if (order.status !== OrderStatus.SUBMITTED) {
      res.status(409).json({
        success: false,
        error: {
          code: 'STATE_CONFLICT',
          message: `Cannot accept Order #${orderId} because its status is ${order.status}`,
        },
      });
      return;
    }

    // Update status to ACCEPTED
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.ACCEPTED,
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        items: true,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        rejectionReason: updatedOrder.rejectionReason,
        totalAmount: Number(updatedOrder.totalAmount).toFixed(2),
        createdAt: updatedOrder.createdAt.toISOString(),
        updatedAt: updatedOrder.updatedAt.toISOString(),
        customer: {
          id: updatedOrder.user.id,
          email: updatedOrder.user.email,
          fullName: updatedOrder.user.fullName,
        },
        items: updatedOrder.items.map((item) => ({
          id: item.id,
          catalogItemId: item.catalogItemId,
          itemName: item.itemNameSnapshot,
          unitPrice: Number(item.unitPriceSnapshot).toFixed(2),
          quantity: item.quantity,
          lineTotal: Number(item.lineTotal).toFixed(2),
        })),
      },
    });
  } catch (error) {
    console.error('Error accepting order:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to accept order' },
    });
  }
});

// PATCH /api/operator/orders/:id/reject - Reject SUBMITTED order with mandatory reason & restore stock (F-07)
operatorRouter.patch('/orders/:id/reject', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId) || orderId <= 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid order ID' },
      });
      return;
    }

    const { reason } = req.body ?? {};
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'A non-empty rejection reason is required' },
      });
      return;
    }
    const trimmedReason = reason.trim();

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        items: true,
      },
    });

    if (!existingOrder) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Order #${orderId} not found` },
      });
      return;
    }

    if (existingOrder.status !== OrderStatus.SUBMITTED) {
      res.status(409).json({
        success: false,
        error: {
          code: 'STATE_CONFLICT',
          message: `Cannot reject Order #${orderId} because its status is ${existingOrder.status}`,
        },
      });
      return;
    }

    const rejectedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.SUBMITTED },
        data: {
          status: OrderStatus.REJECTED,
          rejectionReason: trimmedReason,
        },
      });

      if (updated.count !== 1) {
        throw new Error('STATE_CONFLICT');
      }

      for (const item of existingOrder.items) {
        await tx.catalogItem.update({
          where: { id: item.catalogItemId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
          items: true,
        },
      });
    });

    res.status(200).json({
      success: true,
      data: {
        id: rejectedOrder.id,
        status: rejectedOrder.status,
        rejectionReason: rejectedOrder.rejectionReason,
        totalAmount: Number(rejectedOrder.totalAmount).toFixed(2),
        createdAt: rejectedOrder.createdAt.toISOString(),
        updatedAt: rejectedOrder.updatedAt.toISOString(),
        customer: {
          id: rejectedOrder.user.id,
          email: rejectedOrder.user.email,
          fullName: rejectedOrder.user.fullName,
        },
        items: rejectedOrder.items.map((item) => ({
          id: item.id,
          catalogItemId: item.catalogItemId,
          itemName: item.itemNameSnapshot,
          unitPrice: Number(item.unitPriceSnapshot).toFixed(2),
          quantity: item.quantity,
          lineTotal: Number(item.lineTotal).toFixed(2),
        })),
      },
    });
  } catch (error: any) {
    if (error?.message === 'STATE_CONFLICT') {
      res.status(409).json({
        success: false,
        error: {
          code: 'STATE_CONFLICT',
          message: 'Order can no longer be rejected because its status changed',
        },
      });
      return;
    }
    console.error('Error rejecting order:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to reject order' },
    });
  }
});

// GET /api/operator/catalog - List all catalog items (active & inactive) for operators (F-06)
operatorRouter.get('/catalog', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const items = await prisma.catalogItem.findMany({
      orderBy: { id: 'asc' },
    });
    res.status(200).json({
      success: true,
      data: items.map(formatCatalogItem),
    });
  } catch (error) {
    console.error('Error fetching operator catalog:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve operator catalog' },
    });
  }
});

// POST /api/operator/catalog - Create a new catalog item (F-06 / AC-S2-01, AC-S2-03)
operatorRouter.post('/catalog', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, unitPrice, stockQuantity, isActive } = req.body;

    if (
      typeof name !== 'string' ||
      name.trim().length === 0 ||
      typeof description !== 'string' ||
      description.trim().length === 0 ||
      typeof unitPrice !== 'number' ||
      !Number.isFinite(unitPrice) ||
      unitPrice <= 0 ||
      typeof stockQuantity !== 'number' ||
      !Number.isInteger(stockQuantity) ||
      stockQuantity < 0 ||
      (isActive !== undefined && typeof isActive !== 'boolean')
    ) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Valid name, description, unitPrice > 0, and integer stockQuantity >= 0 are required',
        },
      });
      return;
    }

    const created = await prisma.catalogItem.create({
      data: {
        name: name.trim(),
        description: description.trim(),
        unitPrice: new Prisma.Decimal(unitPrice.toFixed(2)),
        stockQuantity,
        isActive: isActive ?? true,
      },
    });

    res.status(201).json({
      success: true,
      data: formatCatalogItem(created),
    });
  } catch (error) {
    console.error('Error creating catalog item:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create catalog item' },
    });
  }
});

// PATCH /api/operator/catalog/:id - Update existing catalog item without altering order snapshots (F-06 / AC-S2-02)
operatorRouter.patch('/catalog/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const itemId = parseInt(req.params.id, 10);
    if (isNaN(itemId) || itemId <= 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid catalog item ID' },
      });
      return;
    }

    const existing = await prisma.catalogItem.findUnique({ where: { id: itemId } });
    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Catalog item #${itemId} not found` },
      });
      return;
    }

    const { name, description, unitPrice, stockQuantity, isActive } = req.body;
    const updateData: Prisma.CatalogItemUpdateInput = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Item name cannot be empty' },
        });
        return;
      }
      updateData.name = name.trim();
    }

    if (description !== undefined) {
      if (typeof description !== 'string' || description.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Item description cannot be empty' },
        });
        return;
      }
      updateData.description = description.trim();
    }

    if (unitPrice !== undefined) {
      if (typeof unitPrice !== 'number' || !Number.isFinite(unitPrice) || unitPrice <= 0) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Unit price must be greater than 0' },
        });
        return;
      }
      updateData.unitPrice = new Prisma.Decimal(unitPrice.toFixed(2));
    }

    if (stockQuantity !== undefined) {
      if (typeof stockQuantity !== 'number' || !Number.isInteger(stockQuantity) || stockQuantity < 0) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Stock quantity must be an integer >= 0' },
        });
        return;
      }
      updateData.stockQuantity = stockQuantity;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'isActive must be a boolean' },
        });
        return;
      }
      updateData.isActive = isActive;
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'At least one valid field must be provided for update' },
      });
      return;
    }

    const updated = await prisma.catalogItem.update({
      where: { id: itemId },
      data: updateData,
    });

    res.status(200).json({
      success: true,
      data: formatCatalogItem(updated),
    });
  } catch (error) {
    console.error('Error updating catalog item:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update catalog item' },
    });
  }
});
