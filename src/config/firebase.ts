import { initializeApp, cert } from 'firebase-admin/app';
import admin from 'firebase-admin';
import { logger } from '../utils/logger';

export const initializeFirebase = async (): Promise<void> => {
  try {
    if (admin.apps.length === 0) {
      const requiredEnvVars = [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_PRIVATE_KEY',
        'FIREBASE_CLIENT_EMAIL',
      ];

      const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);
      if (missingEnvVars.length > 0) {
        throw new Error(`Missing required Firebase environment variables: ${missingEnvVars.join(', ')}`);
      }

      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID!,
          privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        }),
        projectId: process.env.FIREBASE_PROJECT_ID!,
      });

      logger.info('Firebase Admin SDK initialized successfully');
    } else {
      logger.info('Firebase Admin SDK already initialized');
    }
  } catch (error) {
    logger.error('Firebase initialization failed:', error);
    throw error;
  }
};

export { admin };
export default admin;