import admin from 'firebase-admin';
import { logger } from '../utils/logger';

export const initializeFirebase = async (): Promise<void> => {
  try {
    if (admin.apps.length === 0) {
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID ?? throwError('FIREBASE_PROJECT_ID is missing'),
        privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID ?? throwError('FIREBASE_PRIVATE_KEY_ID is missing'),
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') ?? throwError('FIREBASE_PRIVATE_KEY is missing'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? throwError('FIREBASE_CLIENT_EMAIL is missing'),
        clientId: process.env.FIREBASE_CLIENT_ID ?? throwError('FIREBASE_CLIENT_ID is missing'),
        authUri: process.env.FIREBASE_AUTH_URI ?? throwError('FIREBASE_AUTH_URI is missing'),
        tokenUri: process.env.FIREBASE_TOKEN_URI ?? throwError('FIREBASE_TOKEN_URI is missing'),
      };

      if (!process.env.FIREBASE_PROJECT_ID) {
        throwError('FIREBASE_PROJECT_ID is missing');
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID, // TypeScript now knows it’s string
      });

      logger.info('Firebase Admin SDK initialized successfully');
    }
  } catch (error) {
    logger.error('Firebase initialization failed:', error);
    throw error;
  }
};

function throwError(message: string): never {
  throw new Error(message);
}

export { admin };
export default admin;