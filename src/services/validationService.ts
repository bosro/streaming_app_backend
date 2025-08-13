import { logger } from '@/utils/logger';

interface ReceiptValidationResult {
  isValid: boolean;
  productId?: string;
  transactionId?: string;
  purchaseDate?: Date;
  expiresAt?: Date;
  receiptData?: any;
  error?: string;
}

export class ValidationService {
  public async validateGooglePlayReceipt(receiptData: string): Promise<ReceiptValidationResult> {
    try {
      // In production, implement Google Play Console API validation
      // For now, return a mock validation
      const receipt = JSON.parse(receiptData);
      
      // Mock validation logic
      if (!receipt.purchaseToken || !receipt.productId) {
        return {
          isValid: false,
          error: 'Invalid receipt format',
        };
      }

      return {
        isValid: true,
        productId: receipt.productId,
        transactionId: receipt.orderId,
        purchaseDate: new Date(parseInt(receipt.purchaseTime)),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        receiptData: receipt,
      };
    } catch (error) {
      logger.error('Google Play receipt validation error:', error);
      return {
        isValid: false,
        error: 'Failed to validate receipt',
      };
    }
  }

  public async validateAppleStoreReceipt(receiptData: string): Promise<ReceiptValidationResult> {
    try {
      const isProduction = process.env.APPLE_SANDBOX !== 'true';
      const url = isProduction 
        ? 'https://buy.itunes.apple.com/verifyReceipt'
        : 'https://sandbox.itunes.apple.com/verifyReceipt';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          'receipt-data': receiptData,
          'password': process.env.APPLE_SHARED_SECRET!,
          'exclude-old-transactions': true,
        }),
      });

      const result = await response.json();

      if (result.status !== 0) {
        return {
          isValid: false,
          error: `Apple validation failed with status: ${result.status}`,
        };
      }

      const receipt = result.receipt;
      const latestReceipt = result.latest_receipt_info?.[0] || receipt.in_app?.[0];

      if (!latestReceipt) {
        return {
          isValid: false,
          error: 'No valid transaction found',
        };
      }

      return {
        isValid: true,
        productId: latestReceipt.product_id,
        transactionId: latestReceipt.transaction_id,
        purchaseDate: new Date(parseInt(latestReceipt.purchase_date_ms)),
        expiresAt: latestReceipt.expires_date_ms 
          ? new Date(parseInt(latestReceipt.expires_date_ms))
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        receiptData: result,
      };
    } catch (error) {
      logger.error('Apple Store receipt validation error:', error);
      return {
        isValid: false,
        error: 'Failed to validate receipt',
      };
    }
  }
}