import { PaymentPlatform, SubscriptionTier } from '@prisma/client';

export interface CreateSubscriptionRequest {
  planId: string;
  paymentMethodId?: string;
}

export interface ValidateReceiptRequest {
  receipt: string;
  platform: PaymentPlatform;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  tier: SubscriptionTier;
  features: string[];
  stripePriceId: string;
}

export interface AccessLevel {
  tier: SubscriptionTier;
  hasActiveSubscription: boolean;
  canAccessPremiumContent: boolean;
  canDownloadContent: boolean;
  maxDownloads: number;
  features: {
    unlimitedStreaming: boolean;
    offlineDownloads: boolean;
    premiumContent: boolean;
    adFree: boolean;
    highQualityStreaming: boolean;
  };
}