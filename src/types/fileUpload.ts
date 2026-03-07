/**
 * File Upload Type Definitions
 * 
 * Types for file upload operations including single/multiple uploads,
 * dual version (base + mini) support, and video processing.
 */

/**
 * Result of a single file upload operation
 */
export interface UploadResult {
  /** Relative path to base version (e.g., 'product/uuid-timestamp.webp') */
  path: string;
  
  /** Relative path to minified version (e.g., 'product/uuid-timestamp-mini.webp') */
  miniPath: string;
  
  /** Full CDN URL to base version */
  url: string;
  
  /** Full CDN URL to minified version */
  miniUrl: string;
  
  /** File size in bytes */
  size: number;
  
  /** MIME type of original file */
  mimetype: string;
  
  /** Original filename */
  originalName: string;
  
  /** Warning message if optimization failed (optional) */
  warning?: string;
}

/**
 * Result of multiple file upload operation
 */
export interface MultipleUploadResult {
  /** Array of successfully uploaded files */
  files: UploadResult[];
  
  /** Total number of files uploaded */
  count: number;
  
  /** Array of errors for failed uploads (optional) */
  errors?: Array<{ filename: string; error: string }>;
}

/**
 * Video metadata extracted during processing
 */
export interface VideoMetadata {
  /** Video duration in seconds */
  duration?: number;
  
  /** Video width in pixels */
  width?: number;
  
  /** Video height in pixels */
  height?: number;
  
  /** Video codec */
  codec?: string;
  
  /** Video bitrate */
  bitrate?: number;
  
  /** Timestamp where thumbnail was extracted (seconds) */
  thumbnailTimestamp?: number;
}

/**
 * Image metadata extracted during processing
 */
export interface ImageMetadata {
  /** Image width in pixels */
  width: number;
  
  /** Image height in pixels */
  height: number;
  
  /** Image format (webp, jpeg, png, etc.) */
  format: string;
  
  /** Base version file size in bytes */
  baseSize: number;
  
  /** Mini version file size in bytes */
  miniSize: number;
}

/**
 * Allowed file upload categories
 */
export type FileCategory = 
  | 'product' 
  | 'campaign' 
  | 'users' 
  | 'banner' 
  | 'reviews' 
  | 'category' 
  | 'misc' 
  | 'general';

/**
 * File type classification
 */
export enum FileType {
  IMAGE = 'image',
  VIDEO = 'video',
  OTHER = 'other',
}

/**
 * Upload options
 */
export interface UploadOptions {
  /** File category for organization */
  category?: FileCategory;
  
  /** Custom filename (without extension) */
  customFilename?: string;
  
  /** Skip optimization and store original */
  skipOptimization?: boolean;
  
  /** For videos: timestamp to extract frame (default: 1.0s) */
  videoFrameTimestamp?: number;
}

/**
 * Processing result with metadata
 */
export interface ProcessingResult {
  /** Base version buffer */
  baseBuffer: Buffer;
  
  /** Mini version buffer */
  miniBuffer: Buffer;
  
  /** Metadata about the processed file */
  metadata?: ImageMetadata | VideoMetadata;
  
  /** Any warnings during processing */
  warnings?: string[];
}
