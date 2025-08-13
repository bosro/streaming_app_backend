import { z } from 'zod';

// Common validation schemas
export const idSchema = z.string().cuid('Invalid ID format');

export const emailSchema = z.string().email('Invalid email address');

export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number');

export const phoneSchema = z.string()
  .regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number format')
  .min(10, 'Phone number must be at least 10 digits');

export const urlSchema = z.string().url('Invalid URL format');

export const slugSchema = z.string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format');

// Pagination validation
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// File upload validation
export const fileUploadSchema = z.object({
  filename: z.string().min(1),
  mimetype: z.string().regex(/^(image|video|audio)\//, 'Invalid file type'),
  size: z.number().max(100 * 1024 * 1024, 'File too large (max 100MB)'),
});

// Address validation
export const addressSchema = z.object({
  street: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid postal code'),
  country: z.string().length(2, 'Country must be 2-letter code'),
});

// Credit card validation
export const creditCardSchema = z.object({
  number: z.string().regex(/^\d{13,19}$/, 'Invalid card number'),
  expiryMonth: z.number().int().min(1).max(12),
  expiryYear: z.number().int().min(new Date().getFullYear()),
  cvv: z.string().regex(/^\d{3,4}$/, 'Invalid CVV'),
});

// Price validation
export const priceSchema = z.number()
  .positive('Price must be positive')
  .multipleOf(0.01, 'Price must have at most 2 decimal places');

// Currency validation
export const currencySchema = z.enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD']);

// Content validation
export const contentTitleSchema = z.string()
  .min(1, 'Title is required')
  .max(200, 'Title must be less than 200 characters');

export const contentDescriptionSchema = z.string()
  .max(2000, 'Description must be less than 2000 characters')
  .optional();

export const tagsSchema = z.array(z.string().min(1).max(50))
  .max(10, 'Maximum 10 tags allowed');

// Date validation
export const dateRangeSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
}).refine(data => data.endDate > data.startDate, {
  message: 'End date must be after start date',
  path: ['endDate'],
});

// Custom validators
export const validateFileType = (allowedTypes: string[]) => {
  return z.string().refine(
    (mimetype) => allowedTypes.includes(mimetype),
    { message: `File type must be one of: ${allowedTypes.join(', ')}` }
  );
};

export const validateUnique = async <T>(
  value: T,
  checkFunction: (value: T) => Promise<boolean>,
  errorMessage: string = 'Value must be unique'
) => {
  const isUnique = await checkFunction(value);
  if (!isUnique) {
    throw new Error(errorMessage);
  }
  return value;
};

// Password strength validation
export const validatePasswordStrength = (password: string): {
  isValid: boolean;
  score: number;
  feedback: string[];
} => {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length >= 8) score += 1;
  else feedback.push('Use at least 8 characters');

  if (password.length >= 12) score += 1;
  else feedback.push('Consider using 12+ characters for better security');

  // Character variety
  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Include lowercase letters');

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Include uppercase letters');

  if (/\d/.test(password)) score += 1;
  else feedback.push('Include numbers');

  if (/[^a-zA-Z\d]/.test(password)) score += 1;
  else feedback.push('Include special characters');

  // Common patterns check
  if (!/(.)\1{2,}/.test(password)) score += 1;
  else feedback.push('Avoid repeated characters');

  const commonPasswords = ['password', '123456', 'qwerty', 'admin'];
  if (!commonPasswords.some(common => password.toLowerCase().includes(common))) {
    score += 1;
  } else {
    feedback.push('Avoid common passwords');
  }

  return {
    isValid: score >= 5,
    score: Math.min(score, 5),
    feedback,
  };
};

// IP address validation
export const ipAddressSchema = z.string().regex(
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  'Invalid IP address'
);

// JSON validation
export const jsonSchema = z.string().refine(
  (val) => {
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid JSON format' }
);

// Base64 validation
export const base64Schema = z.string().regex(
  /^[A-Za-z0-9+/]*={0,2}$/,
  'Invalid base64 format'
);

// Hex color validation
export const hexColorSchema = z.string().regex(
  /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  'Invalid hex color format'
);

// Social media username validation
export const usernameSchema = z.string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be less than 30 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores');

// Coordinate validation
export const coordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// Time validation
export const timeSchema = z.string().regex(
  /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
  'Invalid time format (HH:MM)'
);

// Duration validation (in seconds)
export const durationSchema = z.number()
  .int()
  .positive('Duration must be positive')
  .max(86400, 'Duration cannot exceed 24 hours');

// Sanitization helpers
export const sanitizeString = (str: string): string => {
  return str.trim().replace(/[<>]/g, '');
};

export const sanitizeHtml = (html: string): string => {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
};

// Custom error class for validation
export class ValidationError extends Error {
  public field?: string | undefined; 
  public code?: string | undefined;

  constructor(message: string, field?: string, code?: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field; 
    this.code = code;
  }
}

// Validation result type
export interface ValidationResult<T = any> {
  isValid: boolean;
  data?: T;
  errors?: Array<{
    field: string;
    message: string;
    code?: string;
  }>;
}

// Generic validation function
export const validate = <T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> => {
  try {
    const validatedData = schema.parse(data);
    return {
      isValid: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        })),
      };
    }
    return {
      isValid: false,
      errors: [{ field: 'unknown', message: 'Validation failed' }],
    };
  }
};