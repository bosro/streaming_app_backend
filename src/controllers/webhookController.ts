import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/paymentService';
import { logger } from '../utils/logger';

const paymentService = new PaymentService();

export class WebhookController {
  /**
   * @swagger
   * /webhooks/stripe:
   *   post:
   *     summary: Handle Stripe webhooks
   *     tags: [Webhooks]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Webhook processed successfully
   *       400:
   *         description: Invalid webhook
   */
  public async handleStripeWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = req.headers['stripe-signature'] as string;
      
      if (!signature) {
        res.status(400).json({
          success: false,
          message: 'Missing stripe signature',
        });
        return;
      }

      // Parse raw body for webhook verification
      const body = (req as any).rawBody || req.body;
      
      // Verify webhook signature and construct event
      const event = await paymentService.handleWebhook(body, signature);
      
      // Process webhook event
      await paymentService.processWebhookEvent(event);

      logger.info(`Stripe webhook processed: ${event.type} - ${event.id}`);

      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
      });
    } catch (error: any) {
      logger.error('Stripe webhook error:', error);
      
      res.status(400).json({
        success: false,
        message: 'Webhook processing failed',
        error: error.message,
      });
    }
  }
}

export const webhookController = new WebhookController();