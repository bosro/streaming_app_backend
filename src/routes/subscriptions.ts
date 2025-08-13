import { Router } from 'express';
import { body } from 'express-validator';
import { subscriptionController } from '../controllers/subscriptionController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validation';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Subscriptions
 *   description: Subscription management and billing
 */

/**
 * @swagger
 * /subscriptions/plans:
 *   get:
 *     summary: Get available subscription plans
 *     tags: [Subscriptions]
 *     responses:
 *       200:
 *         description: Subscription plans retrieved successfully
 */
router.get('/plans', subscriptionController.getPlans);

/**
 * @swagger
 * /subscriptions:
 *   get:
 *     summary: Get current user's subscription
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription retrieved successfully
 *       404:
 *         description: No active subscription found
 */
router.get('/', authenticate, subscriptionController.getCurrentSubscription);

/**
 * @swagger
 * /subscriptions/create:
 *   post:
 *     summary: Create a new subscription
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *             properties:
 *               planId:
 *                 type: string
 *               paymentMethodId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Subscription created successfully
 *       400:
 *         description: Invalid plan or payment method
 */
router.post('/create', authenticate, validate([
  body('planId').isString().notEmpty().withMessage('Plan ID is required'),
  body('paymentMethodId').optional().isString(),
]), subscriptionController.createSubscription);

/**
 * @swagger
 * /subscriptions/cancel:
 *   post:
 *     summary: Cancel current subscription
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription cancelled successfully
 *       404:
 *         description: No active subscription found
 */
router.post('/cancel', authenticate, subscriptionController.cancelSubscription);

/**
 * @swagger
 * /subscriptions/validate-receipt:
 *   post:
 *     summary: Validate mobile app purchase receipt
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - receipt
 *               - platform
 *             properties:
 *               receipt:
 *                 type: string
 *               platform:
 *                 type: string
 *                 enum: [GOOGLE_PLAY, APPLE_STORE]
 *     responses:
 *       200:
 *         description: Receipt validated successfully
 *       400:
 *         description: Invalid receipt
 */
router.post('/validate-receipt', authenticate, validate([
  body('receipt').isString().notEmpty().withMessage('Receipt data is required'),
  body('platform').isIn(['GOOGLE_PLAY', 'APPLE_STORE']).withMessage('Invalid platform'),
]), subscriptionController.validateReceipt);

/**
 * @swagger
 * /subscriptions/check-access:
 *   get:
 *     summary: Check user's subscription access level
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Access level retrieved successfully
 */
router.get('/check-access', authenticate, subscriptionController.checkAccess);

export default router;