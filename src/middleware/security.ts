import { Request, Response, NextFunction, RequestHandler } from 'express';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

// Initialize Redis client (update with your Redis connection details)
const redis = new Redis({
  host: 'localhost', // Replace with your Redis host
  port: 6379,       // Replace with your Redis port
  // password: 'your-redis-password', // Uncomment if Redis requires authentication
});

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
export const preventBruteForce = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  const ip = req.ip; // Get client IP
  const email = req.body.email || 'unknown'; // Get email or fallback to 'unknown'
  const key = `brute-force:${ip}:${email}`; // Unique key for IP + email combination
  const maxAttempts = 5; // Maximum allowed attempts
  const windowInSeconds = 5 * 60; // 5 minutes window

  try {
    // Increment attempt count in Redis
    const attempts = await redis.incr(key);

    // Set expiration for the key if it's the first attempt
    if (attempts === 1) {
      await redis.expire(key, windowInSeconds);
    }

    // Check if attempts exceed the limit
    if (attempts > maxAttempts) {
      logger.warn(`Brute force attempt blocked from ${ip} for ${email}`);
      return res.status(429).json({
        success: false,
        message: 'Too many login attempts, please try again later',
      });
    }

    logger.info(`Login attempt from ${ip} for ${email} (${attempts}/${maxAttempts})`);
    next();
  } catch (error) {
    logger.error('Redis error in preventBruteForce:', error);
    // Optionally, allow the request to proceed if Redis fails (fail-open behavior)
    next();
  }
};

// Middleware to log sensitive operations
export const auditLog = (operation: string): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    logger.info(`Audit: ${operation}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.userId || 'anonymous',
      timestamp: new Date().toISOString(),
    });
    next();
  };
};

// Handle Redis errors
redis.on('error', (error) => {
  logger.error('Redis connection error:', error);
});