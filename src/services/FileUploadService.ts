import { CustomResponseType } from '@/types';
import * as BunnyStorageSDK from '@bunny.net/storage-sdk';
import { randomUUID } from 'crypto';
import { ReadableStream } from 'stream/web';

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
  url?: string; // optional public URL if BUNNY_BASE_URL is configured
  size: number;
  mimetype: string;
  originalName: string;
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
    const fileExtension = file.originalname.includes('.') ? file.originalname.split('.').pop() : undefined;
    const safeExt = fileExtension ? `.${fileExtension}` : '';
    const filename = `${randomUUID()}-${uniqueSuffix}${safeExt}`;
    // we store without leading slash for internal path, Bunny API expects a leading slash when operating
    const internalPath = `${category}/${filename}`;

    const zone = getZone();
    const webStream = bufferToWebStream(file.buffer);
    // Bunny upload path MUST start with '/'
    const success = await BunnyStorageSDK.file.upload(zone, `/${internalPath}`, webStream, {
      contentType: file.mimetype,
    });

    if (!success) {
      return { message: 'Failed to upload to Bunny storage', data: null, code: 500 };
    }

    // touch unused param to satisfy linter (future: include in audit logs)
    void _uploadedBy;

    const result: UploadedPathInfo = {
      path: internalPath,
      url: BUNNY_BASE_URL ? `${BUNNY_BASE_URL.replace(/\/$/, '')}/${internalPath}` : undefined,
      size: file.size,
      mimetype: file.mimetype,
      originalName: file.originalname,
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
      return {
        path: internalPath,
        url: BUNNY_BASE_URL ? `${BUNNY_BASE_URL.replace(/\/$/, '')}/${internalPath}` : undefined,
        size: f.length,
        mimetype: f.contentType,
        originalName: f.objectName,
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
