import { Router } from 'express';
import { param } from 'express-validator';
import { contentController } from '../controllers/contentController';
import { authenticate } from '../middleware/auth';
import { streamingRateLimiter } from '../middleware/rateLimiter';
import { validate, validatePagination } from '../middleware/validation';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Content
 *   description: Content streaming and management
 */

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
router.get('/', authenticate, validatePagination, contentController.getContent);

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
router.get('/search', authenticate, contentController.searchContent);

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
router.get('/downloads', authenticate, contentController.getDownloads);

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
router.get('/:id', authenticate, validate([
  param('id').isString().notEmpty().withMessage('Content ID is required'),
]), contentController.getContentById);

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
router.get('/:id/stream', authenticate, streamingRateLimiter, validate([
  param('id').isString().notEmpty().withMessage('Content ID is required'),
]), contentController.getStreamingUrl);

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
router.post('/:id/download', authenticate, validate([
  param('id').isString().notEmpty().withMessage('Content ID is required'),
]), contentController.requestDownload);

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
router.put('/:id/progress', authenticate, validate([
  param('id').isString().notEmpty().withMessage('Content ID is required'),
]), contentController.updateProgress);

export default router;