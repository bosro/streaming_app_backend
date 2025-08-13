import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const securityMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Remove X-Powered-By header
  res.removeHeader('X-Powered-By');

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Log suspicious activity
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'DELETE' && req.method !== 'PATCH') {
    logger.warn(`Suspicious HTTP method: ${req.method} from ${req.ip}`);
  }

  // Check for common attack patterns in query parameters
  const queryString = JSON.stringify(req.query).toLowerCase();
  const suspiciousPatterns = [
    'script',
    'javascript:',
    'vbscript:',
    'onload=',
    'onerror=',
    '<script',
    '</script>',
    'eval(',
    'alert(',
    'document.cookie',
    'document.write',
  ];

  for (const pattern of suspiciousPatterns) {
    if (queryString.includes(pattern)) {
      logger.warn(`Suspicious query parameter detected: ${pattern} from ${req.ip}`);
      res.status(400).json({
        success: false,
        message: 'Invalid request parameters',
      });
      return;
    }
  }

  // Rate limiting by IP for suspicious activity
  const suspiciousPaths = ['/admin', '/.env', '/config', '/backup', '/wp-admin'];
  if (suspiciousPaths.some(path => req.path.includes(path))) {
    logger.warn(`Access to suspicious path: ${req.path} from ${req.ip}`);
  }

  next();
};

// Middleware to prevent brute force attacks
export const preventBruteForce = (req: Request, res: Response, next: NextFunction): void => {
  // This would typically use Redis to track failed attempts
  // For now, we'll just log the attempt
  logger.info(`Login attempt from ${req.ip} for ${req.body.email}`);
  next();
};

// Middleware to log sensitive operations
export const auditLog = (operation: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    logger.info(`Audit: ${operation}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.userId,
      timestamp: new Date().toISOString(),
    });
    next();
  };
};