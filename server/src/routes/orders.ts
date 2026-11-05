import { Router, Response } from 'express';
import { Prisma, OrderStatus } from '@prisma/client';
import { prisma } from '../prisma.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const ordersRouter = Router();

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
      data: {
        id: createdOrder.id,
        status: createdOrder.status,
        totalAmount: Number(createdOrder.totalAmount).toFixed(2),
        createdAt: createdOrder.createdAt.toISOString(),
        items: createdOrder.items.map((i) => ({
          catalogItemId: i.catalogItemId,
          itemName: i.itemNameSnapshot,
          unitPrice: Number(i.unitPriceSnapshot).toFixed(2),
          quantity: i.quantity,
          lineTotal: Number(i.lineTotal).toFixed(2)
        }))
      }
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

    const data = orders.map((order) => ({
      id: order.id,
      status: order.status,
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
    }));

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
      data: {
        id: order.id,
        userId: order.userId,
        status: order.status,
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
      }
    });
  } catch (error) {
    console.error('Error fetching order detail:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve order detail' }
    });
  }
});

