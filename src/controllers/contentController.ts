import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, ContentCategory, ContentType } from '@prisma/client';
import { ContentService } from '../services/contentService';
import { StorageService } from '../services/storageService';
import { logger } from '../utils/logger';
import { ApiResponse, AuthenticatedRequest } from '../types/common';

const prisma = new PrismaClient();
const contentService = new ContentService();
const storageService = new StorageService();

const getContentSchema = z.object({
  category: z.nativeEnum(ContentCategory).optional(),
  type: z.nativeEnum(ContentType).optional(),
  page: z.string().transform(Number).pipe(z.number().min(1)).optional().default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional().default('20'),
  search: z.string().optional(),
  isPremium: z.string().transform(val => val === 'true').optional(),
});

const updateProgressSchema = z.object({
  contentId: z.string().cuid(),
  progress: z.number().min(0).max(100),
  duration: z.number().min(0).optional(),
});

export class ContentController {
  /**
   * @swagger
   * /content:
   *   get:
   *     summary: Get content list with filtering and pagination
   *     tags: [Content]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *           enum: [VIDEOS, SHORTS, MINDGASM, AUDIOBOOKS]
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *           enum: [VIDEO, AUDIO]
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
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *       - in: query
   *         name: isPremium
   *         schema:
   *           type: boolean
   *     responses:
   *       200:
   *         description: Content list retrieved successfully
   */
  public async getContent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category, type, page, limit, search, isPremium } = getContentSchema.parse(req.query);
      const userId = req.user!.userId;

      // Get user to check subscription tier
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionTier: true },
      });

      const offset = (page - 1) * limit;

      // Build where clause
      const where: any = {
        isPublished: true,
      };

      if (category) where.category = category;
      if (type) where.type = type;
      if (isPremium !== undefined) where.isPremium = isPremium;
      
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { tags: { has: search } },
        ];
      }

      // If user is not premium, exclude premium content unless they have access
      if (user?.subscriptionTier === 'FREE') {
        where.isPremium = false;
      }

      const [content, total] = await Promise.all([
        prisma.content.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            type: true,
            thumbnailUrl: true,
            duration: true,
            isPremium: true,
            isAdultContent: true,
            tags: true,
            viewCount: true,
            downloadCount: true,
            createdAt: true,
          },
        }),
        prisma.content.count({ where }),
      ]);

      // Get user's progress for this content
      const contentViews = await prisma.contentView.findMany({
        where: {
          userId,
          contentId: { in: content.map(c => c.id) },
        },
        select: {
          contentId: true,
          progress: true,
          completed: true,
        },
      });

      const progressMap = contentViews.reduce((acc, view) => {
        acc[view.contentId] = {
          progress: view.progress,
          completed: view.completed,
        };
        return acc;
      }, {} as Record<string, { progress: number; completed: boolean }>);

      const contentWithProgress = content.map(item => ({
        ...item,
        userProgress: progressMap[item.id] || { progress: 0, completed: false },
      }));

      res.status(200).json({
        success: true,
        message: 'Content retrieved successfully',
        data: {
          content: contentWithProgress,
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
   * /content/{id}:
   *   get:
   *     summary: Get content details by ID
   *     tags: [Content]
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
   *         description: Content details retrieved successfully
   *       404:
   *         description: Content not found
   *       403:
   *         description: Access denied (premium content)
   */
  public async getContentById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const content = await prisma.content.findUnique({
        where: { id },
        include: {
          contentViews: {
            where: { userId },
            select: {
              progress: true,
              completed: true,
              viewedAt: true,
            },
          },
        },
      });

      if (!content || !content.isPublished) {
        res.status(404).json({
          success: false,
          message: 'Content not found',
        } as ApiResponse);
        return;
      }

      // Check if user has access to premium content
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionTier: true },
      });

      if (content.isPremium && user?.subscriptionTier === 'FREE') {
        res.status(403).json({
          success: false,
          message: 'Premium subscription required to access this content',
          data: { requiresUpgrade: true, contentTier: 'PREMIUM' },
        } as ApiResponse);
        return;
      }

      // Increment view count
      await prisma.content.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      });

      // Remove sensitive URLs from response
      const { fileUrl, hlsUrl, ...contentWithoutUrls } = content;
      
      res.status(200).json({
        success: true,
        message: 'Content details retrieved successfully',
        data: {
          content: {
            ...contentWithoutUrls,
            userProgress: content.contentViews[0] || { progress: 0, completed: false },
          },
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /content/{id}/stream:
   *   get:
   *     summary: Get streaming URL for content
   *     tags: [Content]
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
   *         description: Streaming URL generated successfully
   *       404:
   *         description: Content not found
   *       403:
   *         description: Access denied
   */
  public async getStreamingUrl(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const content = await prisma.content.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          fileUrl: true,
          hlsUrl: true,
          isPremium: true,
          isPublished: true,
        },
      });

      if (!content || !content.isPublished) {
        res.status(404).json({
          success: false,
          message: 'Content not found',
        } as ApiResponse);
        return;
      }

      // Check access permissions
      const hasAccess = await contentService.checkUserAccess(userId, content.id);
      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Premium subscription required.',
        } as ApiResponse);
        return;
      }

      // Generate signed URL
      const signedUrl = await storageService.generateSignedUrl(
        content.fileUrl || content.hlsUrl!,
        3600 // 1 hour expiration
      );

      // Track analytics
      await prisma.analytics.create({
        data: {
          event: 'content_stream_requested',
          userId,
          data: { contentId: content.id, contentTitle: content.title },
        },
      });

      res.status(200).json({
        success: true,
        message: 'Streaming URL generated successfully',
        data: {
          url: signedUrl,
          expiresIn: 3600,
          contentId: content.id,
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /content/{id}/download:
   *   post:
   *     summary: Request content download (for offline access)
   *     tags: [Content]
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
   *         description: Download URL generated successfully
   *       403:
   *         description: Download not allowed
   */
  public async requestDownload(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const content = await prisma.content.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          fileUrl: true,
          fileSize: true,
          isPremium: true,
          isPublished: true,
        },
      });

      if (!content || !content.isPublished) {
        res.status(404).json({
          success: false,
          message: 'Content not found',
        } as ApiResponse);
        return;
      }

      // Check if user has download permissions
      const hasAccess = await contentService.checkUserAccess(userId, content.id);
      if (!hasAccess) {
        res.status(403).json({
          success: false,
          message: 'Download access denied. Premium subscription required.',
        } as ApiResponse);
        return;
      }

      // Check if download already exists and is not expired
      const existingDownload = await prisma.download.findUnique({
        where: { userId_contentId: { userId, contentId: content.id } },
      });

      if (existingDownload && existingDownload.expiresAt > new Date()) {
        res.status(200).json({
          success: true,
          message: 'Download already available',
          data: {
            downloadId: existingDownload.id,
            expiresAt: existingDownload.expiresAt,
            alreadyDownloaded: true,
          },
        } as ApiResponse);
        return;
      }

      // Create or update download record
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      
      const download = await prisma.download.upsert({
        where: { userId_contentId: { userId, contentId: content.id } },
        update: {
          expiresAt,
          isExpired: false,
          downloadedAt: new Date(),
        },
        create: {
          userId,
          contentId: content.id,
          expiresAt,
          fileSize: content.fileSize,
        },
      });

      // Generate download URL
      const downloadUrl = await storageService.generateSignedUrl(
        content.fileUrl!,
        7200 // 2 hours for download
      );

      // Update download count
      await prisma.content.update({
        where: { id: content.id },
        data: { downloadCount: { increment: 1 } },
      });

      // Track analytics
      await prisma.analytics.create({
        data: {
          event: 'content_download_requested',
          userId,
          data: { contentId: content.id, contentTitle: content.title },
        },
      });

      res.status(200).json({
        success: true,
        message: 'Download URL generated successfully',
        data: {
          downloadUrl,
          downloadId: download.id,
          expiresAt: download.expiresAt,
          fileSize: content.fileSize,
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /content/{id}/progress:
   *   put:
   *     summary: Update content viewing progress
   *     tags: [Content]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - progress
   *             properties:
   *               progress:
   *                 type: number
   *                 minimum: 0
   *                 maximum: 100
   *               duration:
   *                 type: number
   *                 minimum: 0
   *     responses:
   *       200:
   *         description: Progress updated successfully
   */
  public async updateProgress(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { progress, duration } = updateProgressSchema.parse({ contentId: id, ...req.body });
      const userId = req.user!.userId;

      // Verify content exists
      const content = await prisma.content.findUnique({
        where: { id },
        select: { id: true, isPublished: true },
      });

      if (!content || !content.isPublished) {
        res.status(404).json({
          success: false,
          message: 'Content not found',
        } as ApiResponse);
        return;
      }

      // Update or create progress record
      const contentView = await prisma.contentView.upsert({
        where: { userId_contentId: { userId, contentId: id } },
        update: {
          progress,
          duration,
          completed: progress >= 90, // Consider 90%+ as completed
          updatedAt: new Date(),
        },
        create: {
          userId,
          contentId: id,
          progress,
          duration,
          completed: progress >= 90,
        },
      });

      res.status(200).json({
        success: true,
        message: 'Progress updated successfully',
        data: { contentView },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /content/downloads:
   *   get:
   *     summary: Get user's downloaded content
   *     tags: [Content]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Downloaded content list retrieved successfully
   */
  public async getDownloads(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const downloads = await prisma.download.findMany({
        where: { userId },
        include: {
          content: {
            select: {
              id: true,
              title: true,
              description: true,
              category: true,
              type: true,
              thumbnailUrl: true,
              duration: true,
              fileSize: true,
              createdAt: true,
            },
          },
        },
        orderBy: { downloadedAt: 'desc' },
      });

      // Check for expired downloads and update them
      const now = new Date();
      const expiredDownloads = downloads.filter(d => d.expiresAt < now && !d.isExpired);
      
      if (expiredDownloads.length > 0) {
        await prisma.download.updateMany({
          where: {
            id: { in: expiredDownloads.map(d => d.id) },
          },
          data: { isExpired: true },
        });
      }

      const downloadsWithStatus = downloads.map(download => ({
        ...download,
        isExpired: download.expiresAt < now,
        daysUntilExpiry: Math.ceil((download.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      }));

      res.status(200).json({
        success: true,
        message: 'Downloads retrieved successfully',
        data: { downloads: downloadsWithStatus },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /content/search:
   *   get:
   *     summary: Search content
   *     tags: [Content]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: q
   *         required: true
   *         schema:
   *           type: string
   *           minLength: 2
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *           enum: [VIDEOS, SHORTS, MINDGASM, AUDIOBOOKS]
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *           enum: [VIDEO, AUDIO]
   *     responses:
   *       200:
   *         description: Search results retrieved successfully
   */
  public async searchContent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q: query, category, type } = req.query as {
        q: string;
        category?: ContentCategory;
        type?: ContentType;
      };

      if (!query || query.length < 2) {
        res.status(400).json({
          success: false,
          message: 'Search query must be at least 2 characters long',
        } as ApiResponse);
        return;
      }

      const userId = req.user!.userId;
      
      // Get user subscription tier
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionTier: true },
      });

      const where: any = {
        isPublished: true,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { tags: { has: query } },
        ],
      };

      if (category) where.category = category;
      if (type) where.type = type;
      
      // Filter out premium content for free users
      if (user?.subscriptionTier === 'FREE') {
        where.isPremium = false;
      }

      const results = await prisma.content.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          type: true,
          thumbnailUrl: true,
          duration: true,
          isPremium: true,
          tags: true,
          viewCount: true,
          createdAt: true,
        },
        orderBy: [
          { viewCount: 'desc' },
          { createdAt: 'desc' },
        ],
        take: 50,
      });

      // Track search analytics
      await prisma.analytics.create({
        data: {
          event: 'content_search',
          userId,
          data: { 
            query, 
            category, 
            type, 
            resultsCount: results.length 
          },
        },
      });

      res.status(200).json({
        success: true,
        message: 'Search completed successfully',
        data: {
          results,
          query,
          totalResults: results.length,
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export const contentController = new ContentController();