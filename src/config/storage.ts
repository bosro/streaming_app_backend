import { S3Client } from '@aws-sdk/client-s3';

export const s3Config = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
};

export const s3Client = new S3Client(s3Config);

export const storageConfig = {
  bucket: process.env.AWS_S3_BUCKET!,
  cloudFrontDomain: process.env.AWS_CLOUDFRONT_DOMAIN,
  maxFileSize: 100 * 1024 * 1024, // 100MB
  allowedMimeTypes: [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'audio/mpeg',
    'audio/wav',
    'audio/mp4',
    'image/jpeg',
    'image/png',
    'image/webp',
  ],
};