import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { getNotificationService } from '../services/notificationService';
import { ApiResponse, AuthenticatedRequest } from '../types/common';

const sendNotificationSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  data: z.record(z.string()).optional(),
  imageUrl: z.string().url().nullable().optional(),
  targetUsers: z.array(z.string()).optional(),
});

const registerTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web']),
});

export class NotificationController {
  private notificationService = getNotificationService(); // Instantiate after Firebase initialization

  /**
   * @swagger
   * /notifications:
   *   get:
   *     summary: Get user's notifications
   *     tags: [Notifications]
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
   *         description: Notifications retrieved successfully
   */
  public async getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const userId = req.user!.userId;

      const result = await this.notificationService.getNotificationsForUser(userId, page, limit);

      res.status(200).json({
        success: true,
        message: 'Notifications retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /notifications/{id}/read:
   *   put:
   *     summary: Mark notification as read
   *     tags: [Notifications]
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
   *         description: Notification marked as read
   */
  public async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      await this.notificationService.markNotificationAsRead(userId, id);

      res.status(200).json({
        success: true,
        message: 'Notification marked as read',
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /notifications/register-token:
   *   post:
   *     summary: Register push notification token
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - token
   *               - platform
   *             properties:
   *               token:
   *                 type: string
   *               platform:
   *                 type: string
   *                 enum: [ios, android, web]
   *     responses:
   *       200:
   *         description: Token registered successfully
   */
  public async registerToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, platform } = registerTokenSchema.parse(req.body);
      const userId = req.user!.userId;

      await this.notificationService.registerToken(userId, token, platform);

      res.status(200).json({
        success: true,
        message: 'Push token registered successfully',
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /notifications/send:
   *   post:
   *     summary: Send notification (Admin only)
   *     tags: [Notifications]
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
   *               - body
   *             properties:
   *               title:
   *                 type: string
   *               body:
   *                 type: string
   *               data:
   *                 type: object
   *               imageUrl:
   *                 type: string
   *               targetUsers:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Notification sent successfully
   */
  public async sendNotification(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = sendNotificationSchema.parse(req.body);

      await this.notificationService.sendNotification(validatedData);

      res.status(200).json({
        success: true,
        message: 'Notification sent successfully',
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();