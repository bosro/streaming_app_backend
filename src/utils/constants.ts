export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
  } as const;
  
  export const ERROR_MESSAGES = {
    UNAUTHORIZED: 'Authentication required',
    FORBIDDEN: 'Insufficient permissions',
    NOT_FOUND: 'Resource not found',
    VALIDATION_FAILED: 'Validation failed',
    INTERNAL_ERROR: 'Internal server error',
    TOO_MANY_REQUESTS: 'Too many requests',
    INVALID_TOKEN: 'Invalid or expired token',
    USER_NOT_FOUND: 'User not found',
    INVALID_CREDENTIALS: 'Invalid credentials',
    EMAIL_NOT_VERIFIED: 'Email verification required',
    SUBSCRIPTION_REQUIRED: 'Subscription required',
  } as const;
  
  export const SUBSCRIPTION_TIERS = {
    FREE: 'FREE',
    STANDARD: 'STANDARD',
    PREMIUM: 'PREMIUM',
  } as const;
  
  export const USER_ROLES = {
    USER: 'USER',
    ADMIN: 'ADMIN',
    SUPER_ADMIN: 'SUPER_ADMIN',
  } as const;
  
  export const CONTENT_CATEGORIES = {
    VIDEOS: 'VIDEOS',
    SHORTS: 'SHORTS',
    MINDGASM: 'MINDGASM',
    AUDIOBOOKS: 'AUDIOBOOKS',
  } as const;
  
  export const ORDER_STATUS = {
    PENDING: 'PENDING',
    CONFIRMED: 'CONFIRMED',
    PROCESSING: 'PROCESSING',
    SHIPPED: 'SHIPPED',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED',
    REFUNDED: 'REFUNDED',
  } as const;
  
  export const PAGINATION_DEFAULTS = {
    PAGE: 1,
    LIMIT: 20,
    MAX_LIMIT: 100,
  } as const;
  
  export const FILE_UPLOAD_LIMITS = {
    MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
    MAX_FILES: 10,
  } as const;
  
  export const CACHE_TTL = {
    SHORT: 300, // 5 minutes
    MEDIUM: 1800, // 30 minutes
    LONG: 3600, // 1 hour
    VERY_LONG: 86400, // 24 hours
  } as const;
  
  export const SIGNED_URL_EXPIRY = {
    STREAMING: 3600, // 1 hour
    DOWNLOAD: 7200, // 2 hours
    UPLOAD: 3600, // 1 hour
  } as const;
  
  export const DOWNLOAD_EXPIRY_DAYS = 30;
  
  export const JWT_EXPIRY = {
    ACCESS_TOKEN: '7d',
    REFRESH_TOKEN: '30d',
    EMAIL_VERIFICATION: '24h',
    PASSWORD_RESET: '1h',
  } as const;
  
  export const RATE_LIMITS = {
    AUTH: 5, // 5 attempts per 15 minutes
    PASSWORD_RESET: 3, // 3 attempts per hour
    GENERAL: 100, // 100 requests per 15 minutes
    STREAMING: 30, // 30 requests per minute
  } as const;