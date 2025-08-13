import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  tier: 'STANDARD' | 'PREMIUM';
  features: string[];
  stripePriceId: string;
}

export class SubscriptionService {
  public async getAvailablePlans(): Promise<SubscriptionPlan[]> {
    return [
      {
        id: 'standard_monthly',
        name: 'Standard Monthly',
        description: 'Access to all content with basic features',
        price: 9.99,
        currency: 'USD',
        interval: 'month',
        tier: 'STANDARD',
        features: [
          'Unlimited streaming',
          'Offline downloads (up to 10)',
          'Ad-free experience',
          'HD quality streaming',
        ],
        stripePriceId: process.env.STRIPE_STANDARD_PRICE_ID!,
      },
      {
        id: 'premium_monthly',
        name: 'Premium Monthly',
        description: 'All features with premium content access',
        price: 19.99,
        currency: 'USD',
        interval: 'month',
        tier: 'PREMIUM',
        features: [
          'Everything in Standard',
          'Unlimited downloads',
          'Premium exclusive content',
          '4K Ultra HD streaming',
          'Early access to new content',
          'Priority customer support',
        ],
        stripePriceId: process.env.STRIPE_PREMIUM_PRICE_ID!,
      },
    ];
  }

  public async checkSubscriptionStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: {
          where: {
            status: { in: ['ACTIVE', 'PAST_DUE'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) return null;

    const currentSubscription = user.subscriptions[0];
    if (!currentSubscription) {
      return {
        hasActiveSubscription: false,
        tier: 'FREE',
        subscription: null,
      };
    }

    // Check if subscription is expired
    const now = new Date();
    const isExpired = currentSubscription.currentPeriodEnd < now;

    if (isExpired) {
      await this.expireSubscription(currentSubscription.id);
      return {
        hasActiveSubscription: false,
        tier: 'FREE',
        subscription: null,
      };
    }

    return {
      hasActiveSubscription: true,
      tier: currentSubscription.tier,
      subscription: currentSubscription,
    };
  }

  private async expireSubscription(subscriptionId: string) {
    const subscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'EXPIRED' },
      include: { user: true },
    });

    await prisma.user.update({
      where: { id: subscription.userId },
      data: { subscriptionTier: 'FREE' },
    });
  }

  public async syncSubscriptionStatus() {
    // Find subscriptions that should be expired
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'PAST_DUE'] },
        currentPeriodEnd: { lt: new Date() },
      },
    });

    for (const subscription of expiredSubscriptions) {
      await this.expireSubscription(subscription.id);
    }

    return expiredSubscriptions.length;
  }
}