import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, MessageType } from '@prisma/client';
import { EmailService } from '../services/emailService';
import { logger } from '../utils/logger';
import { ApiResponse, AuthenticatedRequest } from '../types/common';

const prisma = new PrismaClient();
const emailService = new EmailService();

const sendMessageSchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  type: z.nativeEnum(MessageType).default('SUPPORT'),
});

export class MessageController {
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
  public async getMessages(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      const userId = req.user!.userId;

      const [messages, total] = await Promise.all([
        prisma.message.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.message.count({ where: { userId } }),
      ]);

      res.status(200).json({
        success: true,
        message: 'Messages retrieved successfully',
        data: {
          messages,
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
   *               message:
   *                 type: string
   *               type:
   *                 type: string
   *                 enum: [SUPPORT, FEEDBACK, BUG_REPORT, GENERAL]
   *     responses:
   *       201:
   *         description: Message sent successfully
   */
  public async sendMessage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subject, message, type } = sendMessageSchema.parse(req.body);
      const userId = req.user!.userId;

      // Get user info
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        } as ApiResponse);
        return;
      }

      // Create message record
      const newMessage = await prisma.message.create({
        data: {
          userId,
          subject,
          message,
          type,
          status: 'SENT',
        },
      });

      // Send email to admin
      try {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@mystreamingapp.com';
        const emailBody = `
          <h3>New ${type} Message</h3>
          <p><strong>From:</strong> ${user.name} (${user.email})</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Type:</strong> ${type}</p>
          <p><strong>Message:</strong></p>
          <div style="border-left: 3px solid #ccc; padding-left: 15px; margin: 15px 0;">
            ${message.replace(/\n/g, '<br>')}
          </div>
          <p><strong>Message ID:</strong> ${newMessage.id}</p>
          <p><strong>Sent at:</strong> ${newMessage.createdAt}</p>
        `;

        await emailService.sendEmail({
          to: adminEmail,
          subject: `[${type}] ${subject}`,
          html: emailBody,
        });
      } catch (emailError) {
        logger.error('Failed to send admin notification email:', emailError);
        // Don't fail the request if email fails
      }

      logger.info(`Message sent by user ${userId}: ${newMessage.id}`);

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: { message: newMessage },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

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
  public async getMessageById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const message = await prisma.message.findFirst({
        where: {
          id,
          userId,
        },
      });

      if (!message) {
        res.status(404).json({
          success: false,
          message: 'Message not found',
        } as ApiResponse);
        return;
      }

      // Mark as received if it was just sent
      if (message.status === 'SENT') {
        await prisma.message.update({
          where: { id },
          data: { status: 'RECEIVED' },
        });
      }

      res.status(200).json({
        success: true,
        message: 'Message retrieved successfully',
        data: { message },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export const messageController = new MessageController();