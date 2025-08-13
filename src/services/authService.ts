import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AuthService {
  public async generateTokens(userId: string): Promise<{ accessToken: string; refreshToken: string }> {
    // Explicitly type the secret as a string to match jwt.Secret
    const accessToken = jwt.sign(
      { userId, type: 'access' },
      process.env.JWT_SECRET as string, // Ensure the secret is treated as a string
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions // Explicitly type options
    );

    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET as string, // Ensure the secret is treated as a string
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' } as jwt.SignOptions // Explicitly type options
    );

    return { accessToken, refreshToken };
  }

  public verifyAccessToken(token: string): { userId: string } | null {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string; type: string };
      if (decoded.type !== 'access') return null;
      return { userId: decoded.userId };
    } catch (error) {
      return null;
    }
  }

  public verifyRefreshToken(token: string): { userId: string } | null {
    try {
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET as string) as { userId: string; type: string };
      if (decoded.type !== 'refresh') return null;
      return { userId: decoded.userId };
    } catch (error) {
      return null;
    }
  }

  public generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  public generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  public async validateUserSession(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    return !!user;
  }
}