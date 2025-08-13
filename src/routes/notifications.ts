import { Router } from 'express';
import { body, param } from 'express-validator';
import { notificationController } from '../controllers/notificationController';
import { authenticate, requireRole } from '../middleware/auth';
import { validate, validatePagination } from '../middleware/validation';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Push notification management
 */

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
router.get('/', authenticate, validatePagination, notificationController.getNotifications);

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
router.put('/:id/read', authenticate, validate([
  param('id').isString().notEmpty().withMessage('Notification ID is required'),
]), notificationController.markAsRead);

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
router.post('/register-token', authenticate, validate([
  body('token').isString().notEmpty().withMessage('Token is required'),
  body('platform').isIn(['ios', 'android', 'web']).withMessage('Invalid platform'),
]), notificationController.registerToken);

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
router.post('/send', authenticate, requireRole(['ADMIN', 'SUPER_ADMIN']), validate([
  body('title').isString().isLength({ min: 1, max: 100 }).withMessage('Title must be 1-100 characters'),
  body('body').isString().isLength({ min: 1, max: 500 }).withMessage('Body must be 1-500 characters'),
  body('data').optional().isObject(),
  body('imageUrl').optional().isURL(),
  body('targetUsers').optional().isArray(),
]), notificationController.sendNotification);

export default router;