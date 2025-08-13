import admin from 'firebase-admin';
import { logger } from '../utils/logger';

export const initializeFirebase = async (): Promise<void> => {
  try {
    if (admin.apps.length === 0) {
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID!,
        privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID!,
        privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        clientId: process.env.FIREBASE_CLIENT_ID!,
        authUri: process.env.FIREBASE_AUTH_URI!,
        tokenUri: process.env.FIREBASE_TOKEN_URI!,
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });

      logger.info('Firebase Admin SDK initialized successfully');
    }
  } catch (error) {
    logger.error('Firebase initialization failed:', error);
    throw error;
  }
};

export { admin };
export default admin;