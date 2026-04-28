import { CustomResponseType } from '@/types';
import * as BunnyStorageSDK from '@bunny.net/storage-sdk';
import { randomUUID } from 'crypto';
import { ReadableStream } from 'stream/web';
import {
  processImageFile,
  processVideoFile,
  isImageType,
  isVideoType,
  getMiniFilename,
  getPngFilename,
} from '@/utils/ImageProcessor';

// NOTE: This service has been refactored to use Bunny Storage directly.
// We no longer persist upload metadata in Mongo (FileUpload model removed from logic)
// and instead rely on Bunny for listing/deleting. Each upload returns the stored path.

interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer: Buffer;
}
// Bunny environment configuration
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || '';
const BUNNY_ACCESS_KEY = process.env.BUNNY_ACCESS_KEY || '';
const BUNNY_REGION_ENV = (process.env.BUNNY_REGION ||
  'Falkenstein') as keyof typeof BunnyStorageSDK.regions.StorageRegion;
const BUNNY_REGION =
  BunnyStorageSDK.regions.StorageRegion[BUNNY_REGION_ENV] || BunnyStorageSDK.regions.StorageRegion.Falkenstein;
const BUNNY_BASE_URL = process.env.BUNNY_BASE_URL; // e.g. https://cdn.example.com

// Lazily connect (simple memoization)
let zoneConnection: BunnyStorageSDK.StorageZone | null = null;
const getZone = () => {
  if (zoneConnection) return zoneConnection;
  zoneConnection = BunnyStorageSDK.zone.connect_with_accesskey(BUNNY_REGION, BUNNY_STORAGE_ZONE, BUNNY_ACCESS_KEY);
  return zoneConnection;
};

// Convert a Node Buffer to a Web ReadableStream expected by Bunny upload API
const bufferToWebStream = (buffer: Buffer): ReadableStream<Uint8Array> => {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(buffer));
      controller.close();
    },
  });
};

type UploadedPathInfo = {
  path: string; // stored path inside storage zone (leading slash omitted)
  miniPath: string; // minified version path
  pngPath: string; // PNG version path (for OG images)
  url?: string; // optional public URL if BUNNY_BASE_URL is configured
  miniUrl?: string; // optional public URL for minified version
  pngUrl?: string; // optional public URL for PNG version
  // video-only fields — only present when mediaType === 'video'
  thumbnailPath?: string; // WebP thumbnail extracted from video
  thumbnailUrl?: string; // CDN URL for the video thumbnail
  mediaType: 'image' | 'video';
  size: number;
  mimetype: string;
  originalName: string;
  warning?: string; // warning message if optimization failed
};

const uploadFile = async (
  file: UploadedFile,
  category: string,
  _uploadedBy: string // kept for signature consistency; not stored now
): Promise<CustomResponseType<UploadedPathInfo>> => {
  try {
    if (!BUNNY_STORAGE_ZONE || !BUNNY_ACCESS_KEY) {
      return { message: 'Bunny storage not configured', data: null, code: 500 };
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const originalExt = file.originalname.includes('.') ? file.originalname.split('.').pop() : undefined;
    const baseFilename = `${randomUUID()}-${uniqueSuffix}`;

    let baseBuffer = file.buffer;
    let miniBuffer = file.buffer;
    let pngBuffer: Buffer | null = null;
    let finalBaseFilename = `${baseFilename}.${originalExt || 'bin'}`;
    let finalMiniFilename = getMiniFilename(finalBaseFilename);
    let finalPngFilename = getPngFilename(finalBaseFilename);
    let warning: string | undefined;
    let finalMimetype = file.mimetype;

    // Process based on file type
    const isImage = isImageType(file.mimetype);
    const isVideo = isVideoType(file.mimetype);

    // Video-specific paths (set below when isVideo)
    let videoInternalPath: string | undefined;
    let videoSuccess = false;

    if (isImage) {
      try {
        const processed = await processImageFile(file.buffer);
        baseBuffer = processed.baseBuffer;
        miniBuffer = processed.miniBuffer;
        pngBuffer = processed.pngBuffer;
        finalBaseFilename = `${baseFilename}.webp`;
        finalMiniFilename = getMiniFilename(finalBaseFilename);
        finalPngFilename = getPngFilename(finalBaseFilename);
        finalMimetype = 'image/webp';
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Image processing failed:', errorMessage);
        warning = `Image uploaded but optimization failed - original format kept`;
        miniBuffer = baseBuffer;
        pngBuffer = null;
      }
    } else if (isVideo) {
      // For videos: upload the original video file, and generate a WebP thumbnail from frame
      const videoExt = originalExt || 'mp4';
      const rawVideoFilename = `${baseFilename}.${videoExt}`;
      videoInternalPath = `${category}/${rawVideoFilename}`;
      const zone = getZone();
      const videoStream = bufferToWebStream(file.buffer);
      videoSuccess = await BunnyStorageSDK.file.upload(zone, `/${videoInternalPath}`, videoStream, {
        contentType: file.mimetype,
      });
      if (!videoSuccess) {
        return { message: 'Failed to upload video file to Bunny storage', data: null, code: 500 };
      }

      // Generate thumbnail from video frame
      try {
        const processed = await processVideoFile(file.buffer, 1.0);
        baseBuffer = processed.baseBuffer;
        miniBuffer = processed.miniBuffer;
        pngBuffer = processed.pngBuffer;
        finalBaseFilename = `${baseFilename}-thumb.webp`;
        finalMiniFilename = getMiniFilename(finalBaseFilename);
        finalPngFilename = getPngFilename(finalBaseFilename);
        finalMimetype = 'image/webp';
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Video thumbnail generation failed:', errorMessage);
        warning = `Video uploaded but thumbnail generation failed`;
        pngBuffer = null;
      }
    }

    // Upload base version (image WebP or video thumbnail WebP)
    const internalPath = `${category}/${finalBaseFilename}`;
    const zone = getZone();
    const baseStream = bufferToWebStream(baseBuffer);

    const baseSuccess = await BunnyStorageSDK.file.upload(zone, `/${internalPath}`, baseStream, {
      contentType: finalMimetype,
    });

    if (!baseSuccess) {
      return { message: 'Failed to upload base file to Bunny storage', data: null, code: 500 };
    }

    // Upload mini version
    const miniInternalPath = `${category}/${finalMiniFilename}`;
    const miniStream = bufferToWebStream(miniBuffer);

    const miniSuccess = await BunnyStorageSDK.file.upload(zone, `/${miniInternalPath}`, miniStream, {
      contentType: finalMimetype,
    });

    if (!miniSuccess) {
      console.error('Failed to upload mini version, but base uploaded successfully');
      warning = (warning ? warning + '; ' : '') + 'Minified version upload failed';
    }

    // Upload PNG version (for OG images)
    let pngSuccess = false;
    const pngInternalPath = `${category}/${finalPngFilename}`;
    if (pngBuffer) {
      const pngStream = bufferToWebStream(pngBuffer);
      pngSuccess = await BunnyStorageSDK.file.upload(zone, `/${pngInternalPath}`, pngStream, {
        contentType: 'image/png',
      });

      if (!pngSuccess) {
        console.error('Failed to upload PNG version, but base uploaded successfully');
        warning = (warning ? warning + '; ' : '') + 'PNG version upload failed';
      }
    }

    // touch unused param to satisfy linter (future: include in audit logs)
    void _uploadedBy;

    const cdnBase = BUNNY_BASE_URL ? BUNNY_BASE_URL.replace(/\/$/, '') : undefined;

    const result: UploadedPathInfo = isVideo
      ? {
          // For videos: path/url point to the actual video file; thumbnail fields hold the preview image
          path: videoInternalPath!,
          url: cdnBase ? `${cdnBase}/${videoInternalPath}` : undefined,
          thumbnailPath: internalPath,
          thumbnailUrl: cdnBase ? `${cdnBase}/${internalPath}` : undefined,
          miniPath: miniSuccess ? miniInternalPath : internalPath,
          miniUrl: cdnBase
            ? `${cdnBase}/${miniSuccess ? miniInternalPath : internalPath}`
            : undefined,
          pngPath: pngSuccess ? pngInternalPath : internalPath,
          pngUrl: cdnBase ? `${cdnBase}/${pngSuccess ? pngInternalPath : internalPath}` : undefined,
          mediaType: 'video',
          size: file.size,
          mimetype: file.mimetype,
          originalName: file.originalname,
          warning,
        }
      : {
          path: internalPath,
          miniPath: miniSuccess ? miniInternalPath : internalPath,
          pngPath: pngSuccess ? pngInternalPath : internalPath,
          url: cdnBase ? `${cdnBase}/${internalPath}` : undefined,
          miniUrl: cdnBase
            ? `${cdnBase}/${miniSuccess ? miniInternalPath : internalPath}`
            : undefined,
          pngUrl: cdnBase
            ? `${cdnBase}/${pngSuccess ? pngInternalPath : internalPath}`
            : undefined,
          mediaType: 'image',
          size: file.size,
          mimetype: finalMimetype,
          originalName: file.originalname,
          warning,
        };

    return { message: 'File uploaded successfully', data: result, code: 201 };
  } catch (error) {
    console.error('Error uploading file to Bunny:', error);
    return { message: 'Failed to upload file', data: null, code: 500 };
  }
};

const uploadMultipleFiles = async (
  files: UploadedFile[],
  category: string,
  uploadedBy: string
): Promise<CustomResponseType<UploadedPathInfo[]>> => {
  try {
    const uploadedFiles: UploadedPathInfo[] = [];

    // upload all files in parallel, tolerate individual failures
    const uploadPromises: Promise<CustomResponseType<UploadedPathInfo>>[] = files.map((file) =>
      uploadFile(file, category, uploadedBy)
    );

    const settled = (await Promise.allSettled(uploadPromises)) as PromiseSettledResult<
      CustomResponseType<UploadedPathInfo>
    >[];

    for (const res of settled) {
      if (res.status === 'fulfilled') {
        const value = res.value;
        if (value && value.data) uploadedFiles.push(value.data);
      } else {
        // log individual upload failure but continue processing others
        console.error('File upload failed (parallel):', res.reason);
      }
    }

    return {
      message: `${uploadedFiles.length} files uploaded successfully`,
      data: uploadedFiles,
      code: 201,
    };
  } catch (error) {
    console.error('Error uploading multiple files to Bunny:', error);
    return { message: 'Failed to upload files', data: null, code: 500 };
  }
};

const getFilesByCategory = async (
  category: string,
  page = 1,
  limit = 20
): Promise<CustomResponseType<{ files: UploadedPathInfo[]; total: number; page: number; limit: number }>> => {
  try {
    if (!BUNNY_STORAGE_ZONE || !BUNNY_ACCESS_KEY) {
      return { message: 'Bunny storage not configured', data: null, code: 500 };
    }
    const zone = getZone();
    // List at /category (ensure leading slash)
    const list = await BunnyStorageSDK.file.list(zone, `/${category}`);
    // Filter out directories
    const fileEntries = list.filter((f) => !f.isDirectory);
    const total = fileEntries.length;
    const start = (page - 1) * limit;
    const slice = fileEntries.slice(start, start + limit);
    const files: UploadedPathInfo[] = slice.map((f) => {
      const internalPath = f.path.replace(/^\//, '');
      const miniPath = getMiniFilename(internalPath);
      const pngPath = getPngFilename(internalPath);
      return {
        path: internalPath,
        miniPath,
        pngPath,
        url: BUNNY_BASE_URL ? `${BUNNY_BASE_URL.replace(/\/$/, '')}/${internalPath}` : undefined,
        miniUrl: BUNNY_BASE_URL ? `${BUNNY_BASE_URL.replace(/\/$/, '')}/${miniPath}` : undefined,
        pngUrl: BUNNY_BASE_URL ? `${BUNNY_BASE_URL.replace(/\/$/, '')}/${pngPath}` : undefined,
        size: f.length,
        mimetype: f.contentType,
        originalName: f.objectName,
        mediaType: (f.contentType?.startsWith('video/') ? 'video' : 'image') as 'image' | 'video',
      };
    });
    return { message: 'Files retrieved successfully', data: { files, total, page, limit }, code: 200 };
  } catch (error) {
    console.error('Error listing files from Bunny:', error);
    return { message: 'Failed to retrieve files', data: null, code: 500 };
  }
};

// Delete a file by its path (relative without leading slash)
const deleteFile = async (relativePath: string): Promise<CustomResponseType<null>> => {
  try {
    if (!BUNNY_STORAGE_ZONE || !BUNNY_ACCESS_KEY) {
      return { message: 'Bunny storage not configured', data: null, code: 500 };
    }
    const zone = getZone();
    // Ensure leading slash for Bunny API
    const success = await BunnyStorageSDK.file.remove(zone, `/${relativePath.replace(/^\//, '')}`);
    if (!success) return { message: 'File not found or could not be deleted', data: null, code: 404 };
    return { message: 'File deleted successfully', data: null, code: 200 };
  } catch (error) {
    console.error('Error deleting file from Bunny:', error);
    return { message: 'Failed to delete file', data: null, code: 500 };
  }
};

const FileUploadService = {
  uploadFile,
  uploadMultipleFiles,
  getFilesByCategory,
  deleteFile,
};

export default FileUploadService;
