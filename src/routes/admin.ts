import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { adminController } from '../controllers/adminController';
import { authenticate, requireRole } from '../middleware/auth';
import { validate, validatePagination } from '../middleware/validation';
import { auditLog } from '../middleware/security';

const router = Router();

// Apply admin role requirement to all routes
router.use(authenticate);
router.use(requireRole(['ADMIN', 'SUPER_ADMIN']));

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Administrative functions and dashboard
 */

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
router.get('/analytics', auditLog('admin_analytics_view'), adminController.getAnalytics);

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
 *                 maxLength: 200
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
 *                 format: uri
 *               hlsUrl:
 *                 type: string
 *                 format: uri
 *               thumbnailUrl:
 *                 type: string
 *                 format: uri
 *               duration:
 *                 type: number
 *                 minimum: 0
 *               isPremium:
 *                 type: boolean
 *                 default: false
 *               isAdultContent:
 *                 type: boolean
 *                 default: false
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Content created successfully
 */
router.post('/content', auditLog('admin_content_create'), validate([
  body('title').isString().isLength({ min: 1, max: 200 }),
  body('description').optional().isString(),
  body('category').isIn(['VIDEOS', 'SHORTS', 'MINDGASM', 'AUDIOBOOKS']),
  body('type').isIn(['VIDEO', 'AUDIO']),
  body('fileUrl').optional().isURL(),
  body('hlsUrl').optional().isURL(),
  body('thumbnailUrl').optional().isURL(),
  body('duration').optional().isNumeric(),
  body('isPremium').optional().isBoolean(),
  body('isAdultContent').optional().isBoolean(),
  body('tags').optional().isArray(),
]), adminController.createContent);

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
 *                 maxLength: 200
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *                 minimum: 0
 *               currency:
 *                 type: string
 *                 default: USD
 *               category:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *               stockQuantity:
 *                 type: number
 *                 minimum: 0
 *                 default: 0
 *               isDigital:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Product created successfully
 */
router.post('/products', auditLog('admin_product_create'), validate([
  body('name').isString().isLength({ min: 1, max: 200 }),
  body('description').isString().isLength({ min: 1 }),
  body('price').isNumeric().custom(value => value > 0),
  body('currency').optional().isString(),
  body('category').isString().isLength({ min: 1 }),
  body('images').optional().isArray(),
  body('stockQuantity').optional().isInt({ min: 0 }),
  body('isDigital').optional().isBoolean(),
]), adminController.createProduct);

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
 *                 default: content
 *     responses:
 *       200:
 *         description: Upload URL generated successfully
 */
router.post('/upload-url', auditLog('admin_upload_url_generate'), validate([
  body('fileName').isString().notEmpty(),
  body('contentType').isString().notEmpty(),
  body('folder').optional().isString(),
]), adminController.generateUploadUrl);

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
 *           enum: [PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED]
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
router.get('/orders', validatePagination, validate([
  query('status').optional().isIn(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']),
]), adminController.getAllOrders);

export default router;