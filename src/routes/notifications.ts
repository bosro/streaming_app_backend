import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController';
import { authenticate, requireRole } from '../middleware/auth';
import { validatePagination } from '../middleware/validation';

const router = (notificationController: NotificationController) => {
  const r = Router();

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
  r.get('/', authenticate, validatePagination, notificationController.getNotifications.bind(notificationController));

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
  r.put('/:id/read', authenticate, notificationController.markAsRead.bind(notificationController));

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
  r.post('/register-token', authenticate, notificationController.registerToken.bind(notificationController));

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
  r.post('/send', authenticate, requireRole(['ADMIN', 'SUPER_ADMIN']), notificationController.sendNotification.bind(notificationController));

  return r;
};

export default router;