import { Router, Response } from 'express';
import { Prisma, OrderStatus, PaymentStatus, Role } from '@prisma/client';
import { prisma } from '../prisma.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const ordersRouter = Router();

function formatCustomerOrder(
  order: {
    id: number;
    userId: number;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    paymentReference: string | null;
    paidAt: Date | null;
    rejectionReason: string | null;
    totalAmount: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
    items: Array<{
      id: number;
      catalogItemId: number;
      itemNameSnapshot: string;
      unitPriceSnapshot: Prisma.Decimal;
      quantity: number;
      lineTotal: Prisma.Decimal;
    }>;
  },
  includeUserId = false
) {
  return {
    id: order.id,
    ...(includeUserId ? { userId: order.userId } : {}),
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentReference: order.paymentReference,
    paidAt: order.paidAt ? order.paidAt.toISOString() : null,
    rejectionReason: order.rejectionReason,
    totalAmount: Number(order.totalAmount).toFixed(2),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      catalogItemId: item.catalogItemId,
      itemName: item.itemNameSnapshot,
      unitPrice: Number(item.unitPriceSnapshot).toFixed(2),
      quantity: item.quantity,
      lineTotal: Number(item.lineTotal).toFixed(2)
    }))
  };
}

// POST /api/orders - Create a new order with authoritative price calculation
ordersRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const { items } = req.body;

    // Validate items array
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Order must contain at least one item' }
      });
      return;
    }

    // Validate each line item structure
    for (const item of items) {
      if (
        !item ||
        typeof item.catalogItemId !== 'number' ||
        !Number.isInteger(item.catalogItemId) ||
        item.catalogItemId <= 0 ||
        typeof item.quantity !== 'number' ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Each item must have a valid catalogItemId and a positive integer quantity' }
        });
        return;
      }
    }

    // Retrieve unique catalog item IDs
    const itemIds = Array.from(new Set(items.map((i) => i.catalogItemId)));

    // Fetch authoritative catalog items from database
    const catalogItems = await prisma.catalogItem.findMany({
      where: { id: { in: itemIds } }
    });

    const catalogMap = new Map(catalogItems.map((c) => [c.id, c]));

    // Validate existence, active status, and stock
    for (const line of items) {
      const catalogItem = catalogMap.get(line.catalogItemId);

      if (!catalogItem || !catalogItem.isActive) {
        res.status(422).json({
          success: false,
          error: { code: 'ITEM_UNAVAILABLE', message: `Item ID ${line.catalogItemId} is unavailable or inactive` }
        });
        return;
      }

      if (catalogItem.stockQuantity < line.quantity) {
        res.status(422).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: `Insufficient stock for "${catalogItem.name}". Available: ${catalogItem.stockQuantity}, Requested: ${line.quantity}`
          }
        });
        return;
      }
    }

    // Perform atomic transaction: calculate authoritative pricing, persist Order & OrderItems, deduct stock
    const createdOrder = await prisma.$transaction(async (tx) => {
      let totalAmountDecimal = new Prisma.Decimal(0);
      const lineItemRecords: {
        catalogItemId: number;
        itemNameSnapshot: string;
        unitPriceSnapshot: Prisma.Decimal;
        quantity: number;
        lineTotal: Prisma.Decimal;
      }[] = [];

      for (const line of items) {
        const catalogItem = catalogMap.get(line.catalogItemId)!;
        const lineTotal = catalogItem.unitPrice.mul(line.quantity);
        totalAmountDecimal = totalAmountDecimal.add(lineTotal);

        lineItemRecords.push({
          catalogItemId: catalogItem.id,
          itemNameSnapshot: catalogItem.name,
          unitPriceSnapshot: catalogItem.unitPrice,
          quantity: line.quantity,
          lineTotal
        });

        // Deduct inventory
        await tx.catalogItem.update({
          where: { id: catalogItem.id },
          data: { stockQuantity: { decrement: line.quantity } }
        });
      }

      // Create Order
      const order = await tx.order.create({
        data: {
          userId,
          status: OrderStatus.SUBMITTED,
          totalAmount: totalAmountDecimal,
          items: {
            create: lineItemRecords.map((record) => ({
              catalogItemId: record.catalogItemId,
              itemNameSnapshot: record.itemNameSnapshot,
              unitPriceSnapshot: record.unitPriceSnapshot,
              quantity: record.quantity,
              lineTotal: record.lineTotal
            }))
          }
        },
        include: {
          items: true
        }
      });

      return order;
    });

    res.status(201).json({
      success: true,
      data: formatCustomerOrder(createdOrder)
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create order' }
    });
  }
});

// GET /api/orders/my-orders - Retrieve all orders for the authenticated customer
ordersRouter.get('/my-orders', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true
      }
    });

    const data = orders.map((order) => formatCustomerOrder(order));

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching customer orders:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve order history' }
    });
  }
});

// GET /api/orders/:id - Retrieve order details with cross-customer ownership isolation
ordersRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId) || orderId <= 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid order ID' }
      });
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true
      }
    });

    if (!order) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Order #${orderId} not found` }
      });
      return;
    }

    // BR-04 / AC-10: Ownership Protection - Customers can only view their own orders
    if (order.userId !== userId && userRole !== 'OPERATOR') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to access this order' }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: formatCustomerOrder(order, true)
    });
  } catch (error) {
    console.error('Error fetching order detail:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve order detail' }
    });
  }
});

// PATCH /api/orders/:id/cancel - Cancel own SUBMITTED order and atomically restore stock (FR-09 / BR-07)
ordersRouter.patch('/:id/cancel', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId) || orderId <= 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid order ID' }
      });
      return;
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });

    if (!existingOrder) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Order #${orderId} not found` }
      });
      return;
    }

    // BR-07 / AC-16: Only owning CUSTOMER may cancel their order
    if (userRole !== Role.CUSTOMER || existingOrder.userId !== userId) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the owning customer may cancel this order' }
      });
      return;
    }

    // BR-07 / AC-15: Only SUBMITTED orders may be cancelled
    if (existingOrder.status !== OrderStatus.SUBMITTED) {
      res.status(409).json({
        success: false,
        error: {
          code: 'ORDER_NOT_CANCELLABLE',
          message: `Order #${orderId} cannot be cancelled because its status is ${existingOrder.status}`
        }
      });
      return;
    }

    // Atomic state update + payment refund (if PAID) + inventory restoration inside single database transaction
    const cancelledOrder = await prisma.$transaction(async (tx) => {
      const txOrder = await tx.order.findUnique({ where: { id: orderId } });
      if (!txOrder || txOrder.status !== OrderStatus.SUBMITTED) {
        throw new Error('ORDER_NOT_CANCELLABLE');
      }

      const nextPaymentStatus =
        txOrder.paymentStatus === PaymentStatus.PAID ? PaymentStatus.REFUNDED : txOrder.paymentStatus;

      const updated = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.SUBMITTED, paymentStatus: txOrder.paymentStatus },
        data: { status: OrderStatus.CANCELLED, paymentStatus: nextPaymentStatus }
      });

      if (updated.count !== 1) {
        throw new Error('ORDER_NOT_CANCELLABLE');
      }

      for (const item of existingOrder.items) {
        await tx.catalogItem.update({
          where: { id: item.catalogItemId },
          data: { stockQuantity: { increment: item.quantity } }
        });
      }

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true }
      });
    });

    res.status(200).json({
      success: true,
      data: formatCustomerOrder(cancelledOrder)
    });
  } catch (error: any) {
    if (error?.message === 'ORDER_NOT_CANCELLABLE') {
      res.status(409).json({
        success: false,
        error: {
          code: 'ORDER_NOT_CANCELLABLE',
          message: 'Order can no longer be cancelled because its status changed'
        }
      });
      return;
    }
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel order' }
    });
  }
});

// POST /api/orders/:id/pay - Simulated payment checkout for owning CUSTOMER on active UNPAID order (F-08)
ordersRouter.post('/:id/pay', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId) || orderId <= 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid order ID' }
      });
      return;
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });

    if (!existingOrder) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Order #${orderId} not found` }
      });
      return;
    }

    // AC-S2-12: Only owning CUSTOMER may pay for an order
    if (userRole !== Role.CUSTOMER || existingOrder.userId !== userId) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the owning customer may pay for this order' }
      });
      return;
    }

    // AC-S2-11: Order must be UNPAID and not CANCELLED or REJECTED
    const isActiveOrder =
      existingOrder.status === OrderStatus.SUBMITTED || existingOrder.status === OrderStatus.ACCEPTED;
    if (existingOrder.paymentStatus !== PaymentStatus.UNPAID || !isActiveOrder) {
      res.status(409).json({
        success: false,
        error: {
          code: 'ORDER_NOT_PAYABLE',
          message: `Order #${orderId} cannot be paid (status=${existingOrder.status}, paymentStatus=${existingOrder.paymentStatus})`
        }
      });
      return;
    }

    const paidAt = new Date();
    const paymentReference = `PAY-${orderId}-${paidAt.getTime()}`;

    const paidOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: {
          id: orderId,
          paymentStatus: PaymentStatus.UNPAID,
          status: { in: [OrderStatus.SUBMITTED, OrderStatus.ACCEPTED] }
        },
        data: {
          paymentStatus: PaymentStatus.PAID,
          paymentReference,
          paidAt
        }
      });

      if (updated.count !== 1) {
        throw new Error('ORDER_NOT_PAYABLE');
      }

      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true }
      });
    });

    res.status(200).json({
      success: true,
      data: formatCustomerOrder(paidOrder)
    });
  } catch (error: any) {
    if (error?.message === 'ORDER_NOT_PAYABLE') {
      res.status(409).json({
        success: false,
        error: {
          code: 'ORDER_NOT_PAYABLE',
          message: 'Order is no longer eligible for payment'
        }
      });
      return;
    }
    console.error('Error processing payment:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to process simulated payment' }
    });
  }
});

