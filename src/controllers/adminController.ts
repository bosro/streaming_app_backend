import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { StorageService } from '../services/storageService';
import { NotificationService } from '../services/notificationService';
import { logger } from '../utils/logger';
import { ApiResponse, AuthenticatedRequest } from '../types/common';

const prisma = new PrismaClient();
const storageService = new StorageService();
const notificationService = new NotificationService();

const createContentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.enum(['VIDEOS', 'SHORTS', 'MINDGASM', 'AUDIOBOOKS']),
  type: z.enum(['VIDEO', 'AUDIO']),
  fileUrl: z.string().url().optional(),
  hlsUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  duration: z.number().optional(),
  isPremium: z.boolean().default(false),
  isAdultContent: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1),
  price: z.number().positive(),
  currency: z.string().default('USD'),
  category: z.string().min(1),
  images: z.array(z.string().url()).default([]),
  stockQuantity: z.number().min(0).default(0),
  isDigital: z.boolean().default(false),
  weight: z.number().optional(),
  dimensions: z.record(z.number()).optional(),
  customizationOptions: z.any().optional(),
});

export class AdminController {
  /**
   * @swagger
   * /admin/analytics:
   *   get:
   *     summary: Get admin analytics dashboard data
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Analytics data retrieved successfully
   */
  public async getAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // User analytics
      const [
        totalUsers,
        newUsersThisMonth,
        newUsersThisWeek,
        activeSubscriptions,
        totalRevenue,
        revenueThisMonth,
        totalOrders,
        ordersThisMonth,
        contentCount,
        downloadCount,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        prisma.subscription.count({ where: { status: 'ACTIVE' } }),
        prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
        }),
        prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: {
            status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
        prisma.order.count(),
        prisma.order.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        prisma.content.count({ where: { isPublished: true } }),
        prisma.download.count(),
      ]);

      // Content analytics
      const topContent = await prisma.content.findMany({
        where: { isPublished: true },
        orderBy: { viewCount: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          category: true,
          viewCount: true,
          downloadCount: true,
        },
      });

      // Subscription tier distribution
      const subscriptionTiers = await prisma.user.groupBy({
        by: ['subscriptionTier'],
        _count: { subscriptionTier: true },
      });

      const analytics = {
        users: {
          total: totalUsers,
          newThisMonth: newUsersThisMonth,
          newThisWeek: newUsersThisWeek,
          subscriptionTiers: subscriptionTiers.map(tier => ({
            tier: tier.subscriptionTier,
            count: tier._count.subscriptionTier,
          })),
        },
        subscriptions: {
          active: activeSubscriptions,
        },
        revenue: {
          total: Number(totalRevenue._sum.totalAmount || 0),
          thisMonth: Number(revenueThisMonth._sum.totalAmount || 0),
        },
        orders: {
          total: totalOrders,
          thisMonth: ordersThisMonth,
        },
        content: {
          total: contentCount,
          downloads: downloadCount,
          top: topContent,
        },
      };

      res.status(200).json({
        success: true,
        message: 'Analytics retrieved successfully',
        data: { analytics },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /admin/content:
   *   post:
   *     summary: Create new content (Admin only)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - title
   *               - category
   *               - type
   *             properties:
   *               title:
   *                 type: string
   *               description:
   *                 type: string
   *               category:
   *                 type: string
   *                 enum: [VIDEOS, SHORTS, MINDGASM, AUDIOBOOKS]
   *               type:
   *                 type: string
   *                 enum: [VIDEO, AUDIO]
   *               fileUrl:
   *                 type: string
   *               hlsUrl:
   *                 type: string
   *               thumbnailUrl:
   *                 type: string
   *               duration:
   *                 type: number
   *               isPremium:
   *                 type: boolean
   *               isAdultContent:
   *                 type: boolean
   *               tags:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       201:
   *         description: Content created successfully
   */
  public async createContent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = createContentSchema.parse(req.body);

      const content = await prisma.content.create({
        data: {
          ...validatedData,
          metadata: {},
        },
      });

      // Send notification to users about new content
      if (validatedData.isPremium) {
        await notificationService.sendNotification({
          title: 'New Premium Content Available!',
          body: `Check out our latest ${validatedData.category.toLowerCase()}: ${validatedData.title}`,
          data: {
            contentId: content.id,
            category: validatedData.category,
          },
        });
      }

      logger.info(`Content created by admin: ${content.id} - ${content.title}`);

      res.status(201).json({
        success: true,
        message: 'Content created successfully',
        data: { content },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /admin/products:
   *   post:
   *     summary: Create new product (Admin only)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - description
   *               - price
   *               - category
   *             properties:
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *               price:
   *                 type: number
   *               currency:
   *                 type: string
   *               category:
   *                 type: string
   *               images:
   *                 type: array
   *                 items:
   *                   type: string
   *               stockQuantity:
   *                 type: number
   *               isDigital:
   *                 type: boolean
   *     responses:
   *       201:
   *         description: Product created successfully
   */
  public async createProduct(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = createProductSchema.parse(req.body);

      const product = await prisma.product.create({
        data: {
          ...validatedData,
          inStock: validatedData.stockQuantity > 0 || validatedData.isDigital,
        },
      });

      logger.info(`Product created by admin: ${product.id} - ${product.name}`);

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: { product },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /admin/upload-url:
   *   post:
   *     summary: Generate signed upload URL for file uploads
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - fileName
   *               - contentType
   *             properties:
   *               fileName:
   *                 type: string
   *               contentType:
   *                 type: string
   *               folder:
   *                 type: string
   *     responses:
   *       200:
   *         description: Upload URL generated successfully
   */
  public async generateUploadUrl(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fileName, contentType, folder = 'content' } = req.body;

      if (!fileName || !contentType) {
        res.status(400).json({
          success: false,
          message: 'fileName and contentType are required',
        } as ApiResponse);
        return;
      }

      const { uploadUrl, fileKey } = await storageService.generateUploadUrl(
        fileName,
        contentType,
        folder
      );

      res.status(200).json({
        success: true,
        message: 'Upload URL generated successfully',
        data: {
          uploadUrl,
          fileKey,
          publicUrl: storageService.getPublicUrl(fileKey),
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /admin/orders:
   *   get:
   *     summary: Get all orders (Admin only)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
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
   *           maximum: 100
   *           default: 20
   *     responses:
   *       200:
   *         description: Orders retrieved successfully
   */
  public async getAllOrders(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const offset = (page - 1) * limit;

      const where: any = {};
      if (status) where.status = status;

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
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
        prisma.order.count({ where }),
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
}

export const adminController = new AdminController();