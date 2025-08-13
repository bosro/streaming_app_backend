import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const prisma = new PrismaClient();

interface CreateSubscriptionParams {
  customerId: string;
  priceId: string;
  paymentMethodId?: string;
  customerEmail: string;
  customerName: string;
}

interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  customerId: string;
  metadata?: Record<string, string>;
}

export class PaymentService {
  public async createCustomer(email: string, name: string): Promise<Stripe.Customer> {
    return await stripe.customers.create({
      email,
      name,
    });
  }

  public async createSubscription(params: CreateSubscriptionParams): Promise<Stripe.Subscription> {
    const { customerId, priceId, paymentMethodId, customerEmail, customerName } = params;

    // Create or get Stripe customer
    let stripeCustomer: Stripe.Customer;
    
    try {
      const existingCustomers = await stripe.customers.list({
        email: customerEmail,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        stripeCustomer = existingCustomers.data[0];
      } else {
        stripeCustomer = await this.createCustomer(customerEmail, customerName);
      }
    } catch (error) {
      logger.error('Error creating/getting Stripe customer:', error);
      throw new Error('Failed to create customer');
    }

    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: stripeCustomer.id,
      items: [{ price: priceId }],
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        userId: customerId,
      },
    };

    if (paymentMethodId) {
      subscriptionParams.default_payment_method = paymentMethodId;
    }

    return await stripe.subscriptions.create(subscriptionParams);
  }

  public async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  public async createPaymentIntent(params: CreatePaymentIntentParams): Promise<Stripe.PaymentIntent> {
    const { amount, currency, customerId, metadata } = params;

    return await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata: {
        userId: customerId,
        ...metadata,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });
  }

  public async confirmPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return await stripe.paymentIntents.confirm(paymentIntentId);
  }

  public async refundPayment(paymentIntentId: string, amount?: number): Promise<Stripe.Refund> {
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
    };

    if (amount) {
      refundParams.amount = Math.round(amount * 100);
    }

    return await stripe.refunds.create(refundParams);
  }

  public async handleWebhook(body: string, signature: string): Promise<Stripe.Event> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    return stripe.webhooks.constructEvent(body, signature, webhookSecret);
  }

  public async processWebhookEvent(event: Stripe.Event): Promise<void> {
    logger.info(`Processing Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) return;

    logger.info(`Subscription created for user ${userId}: ${subscription.id}`);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) return;

    const dbSubscription = await prisma.subscription.findFirst({
      where: { externalSubscriptionId: subscription.id },
    });

    if (!dbSubscription) return;

    let status: 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'EXPIRED' | 'PAST_DUE' = 'ACTIVE';

    switch (subscription.status) {
      case 'active':
        status = 'ACTIVE';
        break;
      case 'canceled':
        status = 'CANCELLED';
        break;
      case 'past_due':
        status = 'PAST_DUE';
        break;
      default:
        status = 'INACTIVE';
    }

    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });

    // Update user subscription tier
    if (status === 'ACTIVE') {
      await prisma.user.update({
        where: { id: userId },
        data: { subscriptionTier: dbSubscription.tier },
      });
    } else if (status === 'CANCELLED' || status === 'EXPIRED') {
      await prisma.user.update({
        where: { id: userId },
        data: { subscriptionTier: 'FREE' },
      });
    }

    logger.info(`Subscription updated for user ${userId}: ${subscription.id} - Status: ${status}`);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) return;

    await prisma.subscription.updateMany({
      where: { externalSubscriptionId: subscription.id },
      data: { status: 'CANCELLED' },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { subscriptionTier: 'FREE' },
    });

    logger.info(`Subscription deleted for user ${userId}: ${subscription.id}`);
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    logger.info(`Payment succeeded for invoice: ${invoice.id}`);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    logger.error(`Payment failed for invoice: ${invoice.id}`);
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const userId = paymentIntent.metadata?.userId;
    const orderId = paymentIntent.metadata?.orderId;

    if (orderId) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'CONFIRMED',
          paymentIntentId: paymentIntent.id,
        },
      });
    }

    logger.info(`Payment intent succeeded: ${paymentIntent.id} for user ${userId}`);
  }
}