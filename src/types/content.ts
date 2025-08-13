import { ContentCategory, ContentType } from '@prisma/client';

export interface ContentFilters {
  category?: ContentCategory;
  type?: ContentType;
  isPremium?: boolean;
  search?: string;
  tags?: string[];
}

export interface UpdateProgressRequest {
  progress: number;
  duration?: number;
}

export interface StreamingUrlResponse {
  url: string;
  expiresIn: number;
  contentId: string;
}

export interface DownloadRequest {
  contentId: string;
}

export interface DownloadResponse {
  downloadUrl: string;
  downloadId: string;
  expiresAt: Date;
  fileSize?: bigint;
}