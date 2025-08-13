import { Request } from 'express';
import { UserRole, SubscriptionTier } from '@prisma/client';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any[];
  timestamp?: string;
  stack?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  isEmailVerified: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export interface QueryFilters {
  search?: string;
  category?: string;
  type?: string;
  startDate?: Date;
  endDate?: Date;
  isActive?: boolean;
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}