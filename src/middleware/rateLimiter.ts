import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import rateLimit from 'express-rate-limit';
import RedisStore, { RedisReply } from 'rate-limit-redis';
import Redis from 'ioredis';
import { ApiResponse } from '../types/common';

// Create Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Validation middleware
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      next();
      return;
    }

    const extractedErrors = errors.array().map(err => ({
      field: 'param' in err ? err.param : undefined,
      message: err.msg,
      value: 'value' in err ? err.value : undefined,
    }));

    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: extractedErrors,
    } as ApiResponse);
  };
};

// Pagination middleware
export const validatePagination = (req: Request, res: Response, next: NextFunction): void => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  if (page < 1) {
    res.status(400).json({
      success: false,
      message: 'Page must be greater than 0',
    } as ApiResponse);
    return;
  }

  if (limit < 1 || limit > 100) {
    res.status(400).json({
      success: false,
      message: 'Limit must be between 1 and 100',
    } as ApiResponse);
    return;
  }

  req.query.page = page.toString();
  req.query.limit = limit.toString();
  next();
};

// General rate limiter
export const rateLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (command: string, ...args: [string, ...string[]]) => redis.call(command, ...args) as Promise<RedisReply>,
  }),
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per window
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for authentication endpoints
export const authRateLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (command: string, ...args: [string, ...string[]]) => redis.call(command, ...args) as Promise<RedisReply>,
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for password reset
export const passwordResetRateLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (command: string, ...args: [string, ...string[]]) => redis.call(command, ...args) as Promise<RedisReply>,
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset attempts per hour
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again in 1 hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for content streaming
export const streamingRateLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (command: string, ...args: [string, ...string[]]) => redis.call(command, ...args) as Promise<RedisReply>,
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 streaming requests per minute
  message: {
    success: false,
    message: 'Too many streaming requests, please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});