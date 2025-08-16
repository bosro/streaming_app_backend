import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { r2Client, storageConfig } from '../config/storage';

export class StorageService {
  private s3Client: S3Client;
  private bucket: string;
  private cloudFrontDomain: string | undefined; // Explicitly allow undefined

  constructor() {
    this.s3Client = r2Client;
    this.bucket = storageConfig.bucket;
    this.cloudFrontDomain = storageConfig.cloudFrontDomain; // Safe assignment
  }

  public async generateSignedUrl(fileKey: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  public async uploadFile(
    file: Buffer | Uint8Array | string,
    fileName: string,
    contentType: string,
    folder: string = 'uploads'
  ): Promise<string> {
    const fileExtension = path.extname(fileName);
    const uniqueFileName = `${uuidv4()}${fileExtension}`;
    const fileKey = `${folder}/${uniqueFileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
      Body: file,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
    return fileKey;
  }

  public async deleteFile(fileKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
    });

    await this.s3Client.send(command);
  }

  public async generateUploadUrl(
    fileName: string,
    contentType: string,
    folder: string = 'uploads'
  ): Promise<{ uploadUrl: string; fileKey: string }> {
    const fileExtension = path.extname(fileName);
    const uniqueFileName = `${uuidv4()}${fileExtension}`;
    const fileKey = `${folder}/${uniqueFileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });

    return { uploadUrl, fileKey };
  }

  public getPublicUrl(fileKey: string): string {
    if (this.cloudFrontDomain) {
      return `${this.cloudFrontDomain}/${fileKey}`;
    }
    return `${process.env.CLOUDFLARE_R2_ENDPOINT}/${this.bucket}/${fileKey}`;
  }
}


// import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
// import { getSignedUrl as getCloudFrontSignedUrl } from '@aws-sdk/cloudfront-signer';
// import path from 'path';
// import { v4 as uuidv4 } from 'uuid';

// export class StorageService {
//   private s3Client: S3Client;
//   private bucket: string;
//   private cloudFrontDomain?: string | undefined;

//   constructor() {
//     this.s3Client = new S3Client({
//       region: process.env.AWS_REGION || 'us-east-1',
//       credentials: {
//         accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
//         secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
//       },
//     });
//     this.bucket = process.env.AWS_S3_BUCKET!;
//     this.cloudFrontDomain = process.env.AWS_CLOUDFRONT_DOMAIN as string | undefined;
//   }

//   public async generateSignedUrl(fileKey: string, expiresIn: number = 3600): Promise<string> {
//     // If using CloudFront, generate CloudFront signed URL
//     if (this.cloudFrontDomain) {
//       return this.generateCloudFrontSignedUrl(fileKey, expiresIn);
//     }

//     // Otherwise, generate S3 signed URL
//     const command = new GetObjectCommand({
//       Bucket: this.bucket,
//       Key: fileKey,
//     });

//     return await getSignedUrl(this.s3Client, command, { expiresIn });
//   }

//   private generateCloudFrontSignedUrl(fileKey: string, expiresIn: number): string {
//     const privateKey = process.env.AWS_CLOUDFRONT_PRIVATE_KEY!;
//     const keyPairId = process.env.AWS_CLOUDFRONT_KEY_PAIR_ID!;
//     const url = `https://${this.cloudFrontDomain}/${fileKey}`;
//     const dateLessThan = new Date(Date.now() + expiresIn * 1000).toISOString();

//     return getCloudFrontSignedUrl({
//       url,
//       keyPairId,
//       privateKey,
//       dateLessThan,
//     });
//   }

//   public async uploadFile(
//     file: Buffer | Uint8Array | string,
//     fileName: string,
//     contentType: string,
//     folder: string = 'uploads'
//   ): Promise<string> {
//     const fileExtension = path.extname(fileName);
//     const uniqueFileName = `${uuidv4()}${fileExtension}`;
//     const fileKey = `${folder}/${uniqueFileName}`;

//     const command = new PutObjectCommand({
//       Bucket: this.bucket,
//       Key: fileKey,
//       Body: file,
//       ContentType: contentType,
//       ServerSideEncryption: 'AES256',
//     });

//     await this.s3Client.send(command);
//     return fileKey;
//   }

//   public async deleteFile(fileKey: string): Promise<void> {
//     const command = new DeleteObjectCommand({
//       Bucket: this.bucket,
//       Key: fileKey,
//     });

//     await this.s3Client.send(command);
//   }

//   public async generateUploadUrl(
//     fileName: string,
//     contentType: string,
//     folder: string = 'uploads'
//   ): Promise<{ uploadUrl: string; fileKey: string }> {
//     const fileExtension = path.extname(fileName);
//     const uniqueFileName = `${uuidv4()}${fileExtension}`;
//     const fileKey = `${folder}/${uniqueFileName}`;

//     const command = new PutObjectCommand({
//       Bucket: this.bucket,
//       Key: fileKey,
//       ContentType: contentType,
//     });

//     const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });

//     return { uploadUrl, fileKey };
//   }

//   public getPublicUrl(fileKey: string): string {
//     if (this.cloudFrontDomain) {
//       return `${this.cloudFrontDomain}/${fileKey}`;
//     }
//     return `https://${this.bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
//   }
// }