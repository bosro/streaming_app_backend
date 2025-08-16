import admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';

const prisma = new PrismaClient();

interface SendNotificationParams {
  title: string;
  body: string;
  data?: Record<string, string> | undefined;
  imageUrl?: string | null | undefined;
  targetUsers?: string[] | undefined;
}

interface SendToUserParams {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string> | undefined;
  imageUrl?: string | null | undefined;
}

export class NotificationService {
  private messaging: admin.messaging.Messaging;

  constructor(firebaseAdmin: typeof admin) {
    logger.info('Instantiating NotificationService');
    this.messaging = firebaseAdmin.messaging();
  }

  public async sendNotification(params: SendNotificationParams): Promise<void> {
    const { title, body, data, imageUrl, targetUsers } = params;
    try {
      const notification = await prisma.notification.create({
        data: {
          title,
          body,
          data: data ?? {},
          imageUrl: imageUrl ?? null,
          targetUsers: targetUsers ?? ['all'],
          type: 'GENERAL',
        },
      });

      let userIds: string[] = [];
      if (!targetUsers || targetUsers.includes('all')) {
        const users = await prisma.user.findMany({
          where: { pushTokens: { some: { isActive: true } } },
          select: { id: true },
        });
        userIds = users.map((u) => u.id);
      } else {
        userIds = targetUsers;
      }

      const pushTokens = await prisma.pushToken.findMany({
        where: { userId: { in: userIds }, isActive: true },
      });

      if (pushTokens.length === 0) {
        logger.info('No active push tokens found for notification');
        return;
      }

      const messages: admin.messaging.TokenMessage[] = pushTokens.map((token) => ({
        token: token.token,
        notification: {
          title,
          body,
          ...(imageUrl ? { imageUrl } : {}),
        },
        data: data ?? {},
        android: { notification: { icon: 'ic_notification', color: '#000000', sound: 'default' } },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      }));

      const batchSize = 500;
      let sentCount = 0;

      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        try {
          const response = await this.messaging.sendEach(batch);
          sentCount += response.successCount;
          response.responses.forEach((resp: admin.messaging.SendResponse, index: number) => {
            if (!resp.success) {
              const token = batch[index].token;
              logger.error(`Failed to send notification to token ${token}:`, resp.error);
              if (resp.error?.code === 'messaging/registration-token-not-registered') {
                this.deactivateToken(token);
              }
            }
          });
        } catch (error) {
          logger.error('Error sending notification batch:', error);
        }
      }

      await prisma.notification.update({
        where: { id: notification.id },
        data: { sentCount, sentAt: new Date() },
      });

      const userNotifications = userIds.map((userId) => ({
        userId,
        notificationId: notification.id,
      }));

      await prisma.userNotification.createMany({
        data: userNotifications,
        skipDuplicates: true,
      });

      logger.info(`Notification sent to ${sentCount} devices: ${title}`);
    } catch (error) {
      logger.error('Error sending notification:', error);
      throw error;
    }
  }

  public async sendToUser(params: SendToUserParams): Promise<void> {
    const { userId, title, body, data, imageUrl } = params;
    const pushTokens = await prisma.pushToken.findMany({
      where: { userId, isActive: true },
    });

    if (pushTokens.length === 0) {
      logger.info(`No active push tokens found for user ${userId}`);
      return;
    }

    const tokens = pushTokens.map((pt) => pt.token);
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: { title, body, ...(imageUrl ? { imageUrl } : {}) },
      data: data ?? {},
      android: { notification: { icon: 'ic_notification', color: '#000000', sound: 'default' } },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    };

    try {
      const response = await this.messaging.sendEachForMulticast(message);
      response.responses.forEach((resp: admin.messaging.SendResponse, index: number) => {
        if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
          this.deactivateToken(tokens[index]);
        }
      });
      logger.info(`Notification sent to user ${userId}: ${response.successCount}/${tokens.length} devices`);
    } catch (error) {
      logger.error(`Error sending notification to user ${userId}:`, error);
      throw error;
    }
  }

  public async registerToken(userId: string, token: string, platform: string): Promise<void> {
    await prisma.pushToken.upsert({
      where: { token },
      update: { userId, platform, isActive: true, updatedAt: new Date() },
      create: { userId, token, platform, isActive: true },
    });
    logger.info(`Push token registered for user ${userId}: ${platform}`);
  }

  public async deactivateToken(token: string): Promise<void> {
    await prisma.pushToken.updateMany({
      where: { token },
      data: { isActive: false },
    });
    logger.info(`Push token deactivated: ${token}`);
  }

  public async getNotificationsForUser(userId: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      prisma.userNotification.findMany({
        where: { userId },
        include: { notification: true },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.userNotification.count({ where: { userId } }),
    ]);

    return {
      notifications: notifications.map((un) => ({
        id: un.id,
        title: un.notification.title,
        body: un.notification.body,
        data: un.notification.data,
        imageUrl: un.notification.imageUrl,
        isRead: un.isRead,
        readAt: un.readAt,
        createdAt: un.createdAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  public async markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
    await prisma.userNotification.updateMany({
      where: { userId, notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }
}

export const getNotificationService = async () => {
  if (admin.apps.length === 0) {
    throw new Error('Firebase Admin SDK not initialized. Call initializeFirebase first.');
  }
  return new NotificationService(admin);
};