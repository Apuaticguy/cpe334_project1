import { Router, Response } from 'express';
import { Role, OrderStatus } from '@prisma/client';
import { prisma } from '../prisma.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

export const operatorRouter = Router();

// Apply operator guard to all operator routes
operatorRouter.use(requireAuth, requireRole(Role.OPERATOR));

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
