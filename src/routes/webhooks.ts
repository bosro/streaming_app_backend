import { Router } from 'express';
import { webhookController } from '../controllers/webhookController';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Webhooks
 *   description: External service webhooks
 */

// Note: Webhook routes need raw body parsing, handled in the controller
router.post('/stripe', webhookController.handleStripeWebhook);

export default router;