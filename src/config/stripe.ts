import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
});

export const stripeConfig = {
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  standardPriceId: process.env.STRIPE_STANDARD_PRICE_ID!,
  premiumPriceId: process.env.STRIPE_PREMIUM_PRICE_ID!,
};

export default stripe;