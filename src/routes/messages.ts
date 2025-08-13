import { Router } from 'express';
import { body, param } from 'express-validator';
import { messageController } from '../controllers/messageController';
import { authenticate } from '../middleware/auth';
import { validate, validatePagination } from '../middleware/validation';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Messages
 *   description: User messaging and support
 */

/**
 * @swagger
 * /messages:
 *   get:
 *     summary: Get user's messages
 *     tags: [Messages]
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
 *         description: Messages retrieved successfully
 */
router.get('/', authenticate, validatePagination, messageController.getMessages);

/**
 * @swagger
 * /messages:
 *   post:
 *     summary: Send a message to support
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject
 *               - message
 *             properties:
 *               subject:
 *                 type: string
 *                 maxLength: 200
 *               message:
 *                 type: string
 *                 maxLength: 2000
 *               type:
 *                 type: string
 *                 enum: [SUPPORT, FEEDBACK, BUG_REPORT, GENERAL]
 *                 default: SUPPORT
 *     responses:
 *       201:
 *         description: Message sent successfully
 */
router.post('/', authenticate, validate([
  body('subject').isString().isLength({ min: 1, max: 200 }).withMessage('Subject must be 1-200 characters'),
  body('message').isString().isLength({ min: 1, max: 2000 }).withMessage('Message must be 1-2000 characters'),
  body('type').optional().isIn(['SUPPORT', 'FEEDBACK', 'BUG_REPORT', 'GENERAL']),
]), messageController.sendMessage);

/**
 * @swagger
 * /messages/{id}:
 *   get:
 *     summary: Get message by ID
 *     tags: [Messages]
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
 *         description: Message retrieved successfully
 *       404:
 *         description: Message not found
 */
router.get('/:id', authenticate, validate([
  param('id').isString().notEmpty().withMessage('Message ID is required'),
]), messageController.getMessageById);

export default router;