import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, OrderStatus } from '@prisma/client';
import { PaymentService } from '../services/paymentService';
import { EmailService } from '../services/emailService';
import { logger } from '../utils/logger';
import { ApiResponse, AuthenticatedRequest } from '../types/common';
import { generateOrderNumber, calculateTax, calculateShipping } from '../utils/helpers';

const prisma = new PrismaClient();
const paymentService = new PaymentService();
const emailService = new EmailService();

const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().cuid(),
    quantity: z.number().min(1),
    customizations: z.record(z.string()).optional(),
  })).min(1),
  shippingAddress: z.object({
    fullName: z.string().min(1),
    addressLine1: z.string().min(1),
    addressLine2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().min(1),
  }).optional(),
  billingAddress: z.object({
    fullName: z.string().min(1),
    addressLine1: z.string().min(1),
    addressLine2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().min(1),
  }).optional(),
  couponCode: z.string().optional(),
  notes: z.string().optional(),
});

export class OrderController {
  /**
   * @swagger
   * /orders:
   *   post:
   *     summary: Create a new order
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - items
   *             properties:
   *               items:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     productId:
   *                       type: string
   *                     quantity:
   *                       type: integer
   *                     customizations:
   *                       type: object
   *               shippingAddress:
   *                 type: object
   *               couponCode:
   *                 type: string
   *     responses:
   *       201:
   *         description: Order created successfully
   *       400:
   *         description: Invalid order data
   */
  public async createOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = createOrderSchema.parse(req.body);
      const { items, shippingAddress, billingAddress, couponCode, notes } = validatedData;
      const userId = req.user!.userId;

      // Fetch products and validate availability
      const productIds = items.map(item => item.productId);
      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          isActive: true,
        },
      });

      if (products.length !== productIds.length) {
        res.status(400).json({
          success: false,
          message: 'One or more products not found or inactive',
        } as ApiResponse);
        return;
      }

      // Check stock availability
      const stockErrors: string[] = [];
      for (const item of items) {
        const product = products.find(p => p.id === item.productId)!;
        if (!product.inStock || product.stockQuantity < item.quantity) {
          stockErrors.push(`${product.name}: Insufficient stock (available: ${product.stockQuantity})`);
        }
      }

      if (stockErrors.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Stock validation failed',
          errors: stockErrors,
        } as ApiResponse);
        return;
      }

      // Calculate order totals
      let subtotal = 0;
      const orderItems = items.map(item => {
        const product = products.find(p => p.id === item.productId)!;
        const unitPrice = Number(product.price);
        const totalPrice = unitPrice * item.quantity;
        subtotal += totalPrice;

        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice,
          totalPrice,
          customizations: item.customizations || {},
        };
      });

      // Apply coupon discount (simplified)
      let discountAmount = 0;
      if (couponCode) {
        // In production, validate coupon and calculate discount
        if (couponCode.toLowerCase() === 'save10') {
          discountAmount = subtotal * 0.1;
        }
      }

      const shippingCost = calculateShipping(orderItems);
      const taxAmount = calculateTax(subtotal - discountAmount);
      const totalAmount = subtotal + shippingCost + taxAmount - discountAmount;

      // Generate order number
      const orderNumber = generateOrderNumber();

      // Create order in database
      const order = await prisma.order.create({
        data: {
          userId,
          orderNumber,
          status: 'PENDING',
          totalAmount,
          currency: 'USD',
          shippingAddress: shippingAddress || null,
          billingAddress: billingAddress || null,
          shippingCost,
          taxAmount,
          discountAmount: discountAmount > 0 ? discountAmount : null,
          couponCode: couponCode || null,
          notes: notes || null,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          user: {
            select: {
              email: true,
              name: true,
            },
          },
        },
      });

      // Create payment intent with Stripe
      const paymentIntent = await paymentService.createPaymentIntent({
        amount: totalAmount,
        currency: 'USD',
        customerId: userId,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
        },
      });

      // Update order with payment intent ID
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentIntentId: paymentIntent.id },
      });

      logger.info(`Order created: ${order.orderNumber} for user ${userId}`);

      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: {
          order: {
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            totalAmount: order.totalAmount,
            items: order.items,
          },
          paymentIntent: {
            id: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
            amount: paymentIntent.amount,
          },
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /orders:
   *   get:
   *     summary: Get user's orders
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 50
   *           default: 20
   *     responses:
   *       200:
   *         description: Orders retrieved successfully
   */
  public async getUserOrders(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      const userId = req.user!.userId;

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where: { userId },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    images: true,
                    isDigital: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.order.count({ where: { userId } }),
      ]);

      res.status(200).json({
        success: true,
        message: 'Orders retrieved successfully',
        data: {
          orders,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: page < Math.ceil(total / limit),
            hasPrev: page > 1,
          },
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /orders/{id}:
   *   get:
   *     summary: Get order details by ID
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Order details retrieved successfully
   *       404:
   *         description: Order not found
   */
  public async getOrderById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const order = await prisma.order.findFirst({
        where: {
          id,
          userId,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!order) {
        res.status(404).json({
          success: false,
          message: 'Order not found',
        } as ApiResponse);
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Order details retrieved successfully',
        data: { order },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /orders/{id}/cancel:
   *   post:
   *     summary: Cancel an order
   *     tags: [Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Order cancelled successfully
   *       400:
   *         description: Order cannot be cancelled
   */
  public async cancelOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const order = await prisma.order.findFirst({
        where: {
          id,
          userId,
        },
      });

      if (!order) {
        res.status(404).json({
          success: false,
          message: 'Order not found',
        } as ApiResponse);
        return;
      }

      // Check if order can be cancelled
      if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
        res.status(400).json({
          success: false,
          message: 'Order cannot be cancelled at this stage',
        } as ApiResponse);
        return;
      }

      // Cancel payment intent if exists
      if (order.paymentIntentId) {
        try {
          await paymentService.refundPayment(order.paymentIntentId);
        } catch (error) {
          logger.error('Failed to refund payment:', error);
        }
      }

      // Update order status
      const updatedOrder = await prisma.order.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      // Restore product stock
      await this.restoreProductStock(order.id);

      logger.info(`Order cancelled: ${order.orderNumber} by user ${userId}`);

      res.status(200).json({
        success: true,
        message: 'Order cancelled successfully',
        data: { order: updatedOrder },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  private async restoreProductStock(orderId: string): Promise<void> {
    const orderItems = await prisma.orderItem.findMany({
      where: { orderId },
      include: { product: true },
    });

    for (const item of orderItems) {
      if (!item.product.isDigital) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: {
              increment: item.quantity,
            },
          },
        });
      }
    }
  }
}

export const orderController = new OrderController();