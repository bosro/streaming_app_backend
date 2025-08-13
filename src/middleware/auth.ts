import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../services/authService';
import { ApiResponse, AuthenticatedRequest } from '../types/common';

const prisma = new PrismaClient();
const authService = new AuthService();

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Access token required',
      } as ApiResponse);
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer '
    const decoded = authService.verifyAccessToken(token);

    if (!decoded) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      } as ApiResponse);
      return;
    }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        subscriptionTier: true,
        isEmailVerified: true,
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found',
      } as ApiResponse);
      return;
    }

    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      subscriptionTier: user.subscriptionTier,
      isEmailVerified: user.isEmailVerified,
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Authentication failed',
    } as ApiResponse);
  }
};

export const requireEmailVerification = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user?.isEmailVerified) {
    res.status(403).json({
      success: false,
      message: 'Email verification required',
      data: { requiresEmailVerification: true },
    } as ApiResponse);
    return;
  }
  next();
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      } as ApiResponse);
      return;
    }
    next();
  };
};

export const requireSubscription = (requiredTiers: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !requiredTiers.includes(req.user.subscriptionTier)) {
      res.status(403).json({
        success: false,
        message: 'Subscription upgrade required',
        data: { 
          requiresUpgrade: true,
          currentTier: req.user?.subscriptionTier,
          requiredTiers,
        },
      } as ApiResponse);
      return;
    }
    next();
  };
};