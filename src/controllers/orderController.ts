import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, OrderStatus, Prisma } from '@prisma/client';
import { PaymentService } from '../services/paymentService';
import { logger } from '../utils/logger';
import { ApiResponse, AuthenticatedRequest } from '../types/common';
import { generateOrderNumber, calculateTax, calculateShipping } from '../utils/helpers';

const prisma = new PrismaClient();
const paymentService = new PaymentService();

const createOrderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().cuid(),
      quantity: z.number().min(1),
      customizations: z.record(z.string()).optional(),
    }),
  ).min(1),
  shippingAddress: z
    .object({
      fullName: z.string().min(1),
      addressLine1: z.string().min(1),
      addressLine2: z.string().optional(),
      city: z.string().min(1),
      state: z.string().min(1),
      postalCode: z.string().min(1),
      country: z.string().min(1),
    })
    .optional(),
  billingAddress: z
    .object({
      fullName: z.string().min(1),
      addressLine1: z.string().min(1),
      addressLine2: z.string().optional(),
      city: z.string().min(1),
      state: z.string().min(1),
      postalCode: z.string().min(1),
      country: z.string().min(1),
    })
    .optional(),
  couponCode: z.string().optional(),
  notes: z.string().optional(),
});

export class OrderController {
  public async createOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = createOrderSchema.parse(req.body);
      const { items, shippingAddress, billingAddress, couponCode, notes } = validatedData;
      const userId = req.user!.userId;

      // Fetch products and validate availability
      const productIds = items.map((item) => item.productId);
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
        const product = products.find((p) => p.id === item.productId)!;
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
      const orderItems = items.map((item) => {
        const product = products.find((p) => p.id === item.productId)!;
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
          status: 'PENDING' as OrderStatus, // Explicitly cast for type safety
          totalAmount,
          currency: 'USD',
          shippingAddress: shippingAddress ?? Prisma.JsonNull, // Use Prisma.JsonNull for null JSON fields
          billingAddress: billingAddress ?? Prisma.JsonNull, // Use Prisma.JsonNull for null JSON fields
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

  public async getUserOrders(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const skip = (page - 1) * limit;
      const take = Math.min(limit, 50); // Enforce max limit from Swagger spec

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where: { userId },
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    price: true,
                  },
                },
              },
            },
          },
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
          },
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  public async getOrderById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const orderId = req.params.id;

      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          userId, // Ensure the order belongs to the authenticated user
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                },
              },
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
}

export const orderController = new OrderController();