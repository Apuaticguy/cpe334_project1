import { Router, Response } from 'express';
import { Prisma, Role, OrderStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../prisma.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

export const operatorRouter = Router();

function formatOperatorOrder(order: {
  id: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentReference: string | null;
  paidAt: Date | null;
  readyAt: Date | null;
  completedAt: Date | null;
  rejectionReason: string | null;
  totalAmount: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
  user: { id: number; email: string; fullName: string };
  items: Array<{
    id: number;
    catalogItemId: number;
    itemNameSnapshot: string;
    unitPriceSnapshot: Prisma.Decimal;
    quantity: number;
    lineTotal: Prisma.Decimal;
  }>;
}) {
  return {
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentReference: order.paymentReference,
    paidAt: order.paidAt ? order.paidAt.toISOString() : null,
    readyAt: order.readyAt ? order.readyAt.toISOString() : null,
    completedAt: order.completedAt ? order.completedAt.toISOString() : null,
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
  };
}

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

    const data = orders.map(formatOperatorOrder);

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
      data: formatOperatorOrder(updatedOrder),
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
      const txOrder = await tx.order.findUnique({ where: { id: orderId } });
      if (!txOrder || txOrder.status !== OrderStatus.SUBMITTED) {
        throw new Error('STATE_CONFLICT');
      }

      const nextPaymentStatus =
        txOrder.paymentStatus === PaymentStatus.PAID ? PaymentStatus.REFUNDED : txOrder.paymentStatus;

      const updated = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.SUBMITTED, paymentStatus: txOrder.paymentStatus },
        data: {
          status: OrderStatus.REJECTED,
          rejectionReason: trimmedReason,
          paymentStatus: nextPaymentStatus,
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
      data: formatOperatorOrder(rejectedOrder),
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

async function handleFulfillmentTransition(
  req: AuthenticatedRequest,
  res: Response,
  config: {
    expectedStatus: OrderStatus;
    nextStatus: OrderStatus;
    timestampField: 'readyAt' | 'completedAt';
    actionLabel: string;
    failureMessage: string;
  }
) {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId) || orderId <= 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid order ID' },
      });
      return;
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });

    if (!existingOrder) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Order #${orderId} not found` },
      });
      return;
    }

    if (existingOrder.status !== config.expectedStatus) {
      res.status(409).json({
        success: false,
        error: {
          code: 'STATE_CONFLICT',
          message: `Cannot ${config.actionLabel} Order #${orderId} because its status is ${existingOrder.status}`,
        },
      });
      return;
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: config.expectedStatus },
        data: {
          status: config.nextStatus,
          [config.timestampField]: new Date(),
        },
      });

      if (updated.count !== 1) {
        throw new Error('STATE_CONFLICT');
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
      data: formatOperatorOrder(updatedOrder),
    });
  } catch (error: any) {
    if (error?.message === 'STATE_CONFLICT') {
      res.status(409).json({
        success: false,
        error: {
          code: 'STATE_CONFLICT',
          message: 'Order state changed before fulfillment update could complete',
        },
      });
      return;
    }
    console.error(config.failureMessage, error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: config.failureMessage },
    });
  }
}

// PATCH /api/operator/orders/:id/ready - Advance ACCEPTED order to READY_FOR_PICKUP (F-09)
operatorRouter.patch('/orders/:id/ready', (req: AuthenticatedRequest, res: Response) =>
  handleFulfillmentTransition(req, res, {
    expectedStatus: OrderStatus.ACCEPTED,
    nextStatus: OrderStatus.READY_FOR_PICKUP,
    timestampField: 'readyAt',
    actionLabel: 'mark ready',
    failureMessage: 'Failed to mark order ready for pickup',
  })
);

// PATCH /api/operator/orders/:id/complete - Advance READY_FOR_PICKUP order to COMPLETED (F-09)
operatorRouter.patch('/orders/:id/complete', (req: AuthenticatedRequest, res: Response) =>
  handleFulfillmentTransition(req, res, {
    expectedStatus: OrderStatus.READY_FOR_PICKUP,
    nextStatus: OrderStatus.COMPLETED,
    timestampField: 'completedAt',
    actionLabel: 'complete',
    failureMessage: 'Failed to complete order',
  })
);

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
