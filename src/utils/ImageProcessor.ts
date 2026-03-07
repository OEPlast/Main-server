import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { Readable } from 'stream';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Configuration for image processing
 */
const CONFIG = {
  BASE_QUALITY: 90,
  MINI_QUALITY: 10,
  MINI_BLUR_SIGMA: 5, // 5% blur (higher = more blur)
  VIDEO_FRAME_TIMESTAMP: 1.0, // Extract frame at 1 second
  WEBP_FORMAT: 'webp',
};

/**
 * Convert image buffer to WebP format with specified quality
 * @param buffer - Original image buffer
 * @param quality - Quality percentage (1-100)
 * @returns WebP image buffer
 * @throws Error if conversion fails
 */
export async function convertToWebP(buffer: Buffer, quality: number = CONFIG.BASE_QUALITY): Promise<Buffer> {
  try {
    const webpBuffer = await sharp(buffer)
      .webp({ quality, effort: 4 }) // effort 0-6, higher = better compression but slower
      .toBuffer();

    return webpBuffer;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`WebP conversion failed: ${errorMessage}`);
  }
}

/**
 * Generate minified version of image (10% quality + 5% blur)
 * @param buffer - Original image buffer
 * @returns Minified WebP image buffer
 * @throws Error if conversion fails
 */
export async function generateMiniVersion(buffer: Buffer): Promise<Buffer> {
  try {
    const miniBuffer = await sharp(buffer)
      .blur(CONFIG.MINI_BLUR_SIGMA)
      .webp({ quality: CONFIG.MINI_QUALITY, effort: 4 })
      .toBuffer();

    return miniBuffer;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Mini version generation failed: ${errorMessage}`);
  }
}

/**
 * Extract a frame from video or GIF at specified timestamp
 * @param buffer - Video or GIF buffer
 * @param timestamp - Time in seconds to extract frame (default: 1.0s)
 * @returns Frame as PNG buffer
 * @throws Error if extraction fails
 */
export async function extractVideoFrame(
  buffer: Buffer,
  timestamp: number = CONFIG.VIDEO_FRAME_TIMESTAMP
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const bufferStream = Readable.from(buffer);
      const chunks: Buffer[] = [];

      ffmpeg(bufferStream)
        .seekInput(timestamp)
        .frames(1)
        .format('image2')
        .outputOptions(['-q:v 2']) // High quality JPEG (scale 2-31, lower = better)
        .on('error', (err) => {
          reject(new Error(`Video frame extraction failed: ${err.message}`));
        })
        .on('end', () => {
          if (chunks.length === 0) {
            reject(new Error('No frame extracted from video'));
          } else {
            // Buffer.concat accepts readonly Uint8Array[], and Buffer extends Uint8Array
            resolve(Buffer.concat(chunks as readonly Uint8Array[]));
          }
        })
        .pipe()
        .on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        })
        .on('error', (err: Error) => {
          reject(new Error(`Stream error during frame extraction: ${err.message}`));
        });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reject(new Error(`Failed to initialize video frame extraction: ${errorMessage}`));
    }
  });
}

/**
 * Process image file: convert to WebP and generate mini version
 * @param buffer - Original image buffer
 * @returns Object with base and mini WebP buffers
 */
export async function processImageFile(buffer: Buffer): Promise<{
  baseBuffer: Buffer;
  miniBuffer: Buffer;
}> {
  try {
    // Generate both versions in parallel for efficiency
    const [baseBuffer, miniBuffer] = await Promise.all([
      convertToWebP(buffer, CONFIG.BASE_QUALITY),
      generateMiniVersion(buffer),
    ]);

    return { baseBuffer, miniBuffer };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Image processing failed: ${errorMessage}`);
  }
}

/**
 * Process video/GIF file: extract frame, convert to WebP, and generate mini version
 * @param buffer - Video or GIF buffer
 * @param timestamp - Time in seconds to extract frame (default: 1.0s)
 * @returns Object with base and mini WebP buffers
 */
export async function processVideoFile(
  buffer: Buffer,
  timestamp?: number
): Promise<{
  baseBuffer: Buffer;
  miniBuffer: Buffer;
}> {
  try {
    // Extract frame from video
    const frameBuffer = await extractVideoFrame(buffer, timestamp);

    // Convert frame to WebP and generate mini version
    const [baseBuffer, miniBuffer] = await Promise.all([
      convertToWebP(frameBuffer, CONFIG.BASE_QUALITY),
      generateMiniVersion(frameBuffer),
    ]);

    return { baseBuffer, miniBuffer };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Video processing failed: ${errorMessage}`);
  }
}

/**
 * Check if file is a video type
 * @param mimetype - File MIME type
 * @returns True if video type
 */
export function isVideoType(mimetype: string): boolean {
  return mimetype.startsWith('video/');
}

/**
 * Check if file is an image type (including GIF)
 * @param mimetype - File MIME type
 * @returns True if image type
 */
export function isImageType(mimetype: string): boolean {
  return mimetype.startsWith('image/');
}

/**
 * Get WebP extension for file
 * @param originalName - Original filename
 * @returns Filename with .webp extension
 */
export function getWebPFilename(originalName: string): string {
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
  return `${nameWithoutExt}.webp`;
}

/**
 * Get mini version filename
 * @param filename - Original filename
 * @returns Filename with -mini suffix before extension
 */
export function getMiniFilename(filename: string): string {
  const ext = filename.split('.').pop();
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  return `${nameWithoutExt}-mini.${ext}`;
}
