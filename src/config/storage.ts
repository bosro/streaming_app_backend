import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';

// Ensure environment variables are set
if (
  !process.env.CLOUDFLARE_R2_ENDPOINT ||
  !process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
  !process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
  !process.env.CLOUDFLARE_R2_BUCKET
) {
  throw new Error('Missing required Cloudflare R2 environment variables');
}

export const r2Config: S3ClientConfig = {
  region: 'auto', // Always 'auto' for R2
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT, // Assert as string since we check above
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
};

export const storageConfig = {
  bucket: process.env.CLOUDFLARE_R2_BUCKET,
  cloudFrontDomain: process.env.CLOUDFRONT_DOMAIN as string | undefined, // Explicitly allow undefined
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

export const r2Client = new S3Client(r2Config);




// import { S3Client } from '@aws-sdk/client-s3';

// export const s3Config = {
//   region: process.env.AWS_REGION || 'us-east-1',
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
//   },
// };

// export const s3Client = new S3Client(s3Config);

// export const storageConfig = {
//   bucket: process.env.AWS_S3_BUCKET!,
//   cloudFrontDomain: process.env.AWS_CLOUDFRONT_DOMAIN,
//   maxFileSize: 100 * 1024 * 1024, // 100MB
//   allowedMimeTypes: [
//     'video/mp4',
//     'video/quicktime',
//     'video/x-msvideo',
//     'audio/mpeg',
//     'audio/wav',
//     'audio/mp4',
//     'image/jpeg',
//     'image/png',
//     'image/webp',
//   ],
// };