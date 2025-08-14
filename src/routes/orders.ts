import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { orderController } from '../controllers/orderController';
import { authenticate } from '../middleware/auth';
import { validate, validatePagination } from '../middleware/validation';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order management and processing
 */

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
router.post(
  '/',
  authenticate,
  validate([
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.productId').isString().notEmpty().withMessage('Product ID is required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  ]),
  orderController.createOrder,
);

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
router.get(
  '/',
  authenticate,
  validatePagination,
  validate([
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
  ]),
  orderController.getUserOrders,
);

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
router.get(
  '/:id',
  authenticate,
  validate([param('id').isString().notEmpty().withMessage('Order ID is required')]),
  orderController.getOrderById,
);

export default router;