import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, SubscriptionStatus, SubscriptionTier, PaymentPlatform } from '@prisma/client';
import { SubscriptionService } from '../services/subscriptionService';
import { PaymentService } from '../services/paymentService';
import { ValidationService } from '../services/validationService';
import { logger } from '../utils/logger';
import { ApiResponse, AuthenticatedRequest } from '../types/common';

const prisma = new PrismaClient();
const subscriptionService = new SubscriptionService();
const paymentService = new PaymentService();
const validationService = new ValidationService();

const createSubscriptionSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  paymentMethodId: z.string().optional(),
});

const validateReceiptSchema = z.object({
  receipt: z.string().min(1, 'Receipt data is required'),
  platform: z.nativeEnum(PaymentPlatform),
});

export class SubscriptionController {
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
  public async getPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plans = await subscriptionService.getAvailablePlans();

      res.status(200).json({
        success: true,
        message: 'Subscription plans retrieved successfully',
        data: { plans },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

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
  public async getCurrentSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const subscription = await prisma.subscription.findFirst({
        where: {
          userId,
          status: { in: ['ACTIVE', 'PAST_DUE'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!subscription) {
        res.status(404).json({
          success: false,
          message: 'No active subscription found',
        } as ApiResponse);
        return;
      }

      // Check if subscription is expired
      const now = new Date();
      const isExpired = subscription.currentPeriodEnd < now;
      
      if (isExpired && subscription.status === 'ACTIVE') {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'EXPIRED' },
        });
        
        await prisma.user.update({
          where: { id: userId },
          data: { subscriptionTier: 'FREE' },
        });
      }

      const subscriptionWithDetails = {
        ...subscription,
        isExpired,
        daysUntilExpiry: Math.ceil((subscription.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      };

      res.status(200).json({
        success: true,
        message: 'Subscription retrieved successfully',
        data: { subscription: subscriptionWithDetails },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

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
  public async createSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { planId, paymentMethodId } = createSubscriptionSchema.parse(req.body);
      const userId = req.user!.userId;

      // Check if user already has an active subscription
      const existingSubscription = await prisma.subscription.findFirst({
        where: {
          userId,
          status: { in: ['ACTIVE', 'PAST_DUE'] },
        },
      });

      if (existingSubscription) {
        res.status(400).json({
          success: false,
          message: 'User already has an active subscription',
        } as ApiResponse);
        return;
      }

      // Get user details
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        } as ApiResponse);
        return;
      }

      // Create Stripe subscription
      const stripeSubscription = await paymentService.createSubscription({
        customerId: user.id,
        priceId: planId,
        paymentMethodId,
        customerEmail: user.email,
        customerName: user.name || '',
      });

      // Determine subscription tier based on plan
      const tier: SubscriptionTier = planId.includes('premium') ? 'PREMIUM' : 'STANDARD';

      // Create subscription record
      const subscription = await prisma.subscription.create({
        data: {
          userId,
          planId,
          status: 'ACTIVE',
          tier,
          platform: 'STRIPE',
          externalSubscriptionId: stripeSubscription.id,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        },
      });

      // Update user's subscription tier
      await prisma.user.update({
        where: { id: userId },
        data: { subscriptionTier: tier },
      });

      // Track analytics
      await prisma.analytics.create({
        data: {
          event: 'subscription_created',
          userId,
          data: { 
            subscriptionId: subscription.id,
            planId,
            tier,
            platform: 'STRIPE',
          },
        },
      });

      logger.info(`Subscription created for user ${userId}: ${subscription.id}`);

      res.status(201).json({
        success: true,
        message: 'Subscription created successfully',
        data: { 
          subscription,
          clientSecret: stripeSubscription.latest_invoice?.payment_intent?.client_secret,
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

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
  public async cancelSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const subscription = await prisma.subscription.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
        },
      });

      if (!subscription) {
        res.status(404).json({
          success: false,
          message: 'No active subscription found',
        } as ApiResponse);
        return;
      }

      // Cancel with Stripe
      if (subscription.platform === 'STRIPE' && subscription.externalSubscriptionId) {
        await paymentService.cancelSubscription(subscription.externalSubscriptionId);
      }

      // Update subscription to cancel at period end
      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: true,
          canceledAt: new Date(),
        },
      });

      // Track analytics
      await prisma.analytics.create({
        data: {
          event: 'subscription_cancelled',
          userId,
          data: { 
            subscriptionId: subscription.id,
            tier: subscription.tier,
            platform: subscription.platform,
          },
        },
      });

      logger.info(`Subscription cancelled for user ${userId}: ${subscription.id}`);

      res.status(200).json({
        success: true,
        message: 'Subscription cancelled successfully. You will retain access until the end of your current billing period.',
        data: { subscription: updatedSubscription },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

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
  public async validateReceipt(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { receipt, platform } = validateReceiptSchema.parse(req.body);
      const userId = req.user!.userId;

      let validationResult;
      
      if (platform === 'GOOGLE_PLAY') {
        validationResult = await validationService.validateGooglePlayReceipt(receipt);
      } else if (platform === 'APPLE_STORE') {
        validationResult = await validationService.validateAppleStoreReceipt(receipt);
      } else {
        res.status(400).json({
          success: false,
          message: 'Unsupported platform',
        } as ApiResponse);
        return;
      }

      if (!validationResult.isValid) {
        res.status(400).json({
          success: false,
          message: 'Invalid receipt',
          data: { error: validationResult.error },
        } as ApiResponse);
        return;
      }

      // Determine subscription tier based on product ID
      const tier: SubscriptionTier = validationResult.productId?.includes('premium') ? 'PREMIUM' : 'STANDARD';

      // Create or update subscription
      const subscription = await prisma.subscription.upsert({
        where: {
          externalSubscriptionId: validationResult.transactionId || `${platform}_${userId}_${Date.now()}`,
        },
        update: {
          status: 'ACTIVE',
          currentPeriodEnd: validationResult.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          receipt: validationResult.receiptData,
        },
        create: {
          userId,
          planId: validationResult.productId || 'mobile_subscription',
          status: 'ACTIVE',
          tier,
          platform,
          externalSubscriptionId: validationResult.transactionId || `${platform}_${userId}_${Date.now()}`,
          currentPeriodStart: validationResult.purchaseDate || new Date(),
          currentPeriodEnd: validationResult.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          receipt: validationResult.receiptData,
        },
      });

      // Update user's subscription tier
      await prisma.user.update({
        where: { id: userId },
        data: { subscriptionTier: tier },
      });

      // Track analytics
      await prisma.analytics.create({
        data: {
          event: 'mobile_subscription_validated',
          userId,
          data: { 
            subscriptionId: subscription.id,
            platform,
            productId: validationResult.productId,
            tier,
          },
        },
      });

      logger.info(`Mobile subscription validated for user ${userId}: ${subscription.id}`);

      res.status(200).json({
        success: true,
        message: 'Receipt validated successfully',
        data: { 
          subscription,
          validationResult: {
            productId: validationResult.productId,
            purchaseDate: validationResult.purchaseDate,
            expiresAt: validationResult.expiresAt,
          },
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

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
  public async checkAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          subscriptionTier: true,
          subscriptions: {
            where: {
              status: { in: ['ACTIVE', 'PAST_DUE'] },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        } as ApiResponse);
        return;
      }

      const hasActiveSubscription = user.subscriptions.length > 0;
      const currentSubscription = user.subscriptions[0];

      let accessLevel = {
        tier: user.subscriptionTier,
        hasActiveSubscription,
        canAccessPremiumContent: user.subscriptionTier !== 'FREE',
        canDownloadContent: user.subscriptionTier !== 'FREE',
        maxDownloads: user.subscriptionTier === 'PREMIUM' ? -1 : user.subscriptionTier === 'STANDARD' ? 10 : 0,
        features: {
          unlimitedStreaming: user.subscriptionTier !== 'FREE',
          offlineDownloads: user.subscriptionTier !== 'FREE',
          premiumContent: user.subscriptionTier === 'PREMIUM',
          adFree: user.subscriptionTier !== 'FREE',
          highQualityStreaming: user.subscriptionTier === 'PREMIUM',
        },
      };

      // Check if subscription is actually expired
      if (currentSubscription && currentSubscription.currentPeriodEnd < new Date()) {
        accessLevel = {
          ...accessLevel,
          tier: 'FREE',
          hasActiveSubscription: false,
          canAccessPremiumContent: false,
          canDownloadContent: false,
          maxDownloads: 0,
          features: {
            unlimitedStreaming: false,
            offlineDownloads: false,
            premiumContent: false,
            adFree: false,
            highQualityStreaming: false,
          },
        };

        // Update user tier if needed
        if (user.subscriptionTier !== 'FREE') {
          await prisma.user.update({
            where: { id: userId },
            data: { subscriptionTier: 'FREE' },
          });
        }
      }

      res.status(200).json({
        success: true,
        message: 'Access level retrieved successfully',
        data: { access: accessLevel },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export const subscriptionController = new SubscriptionController();