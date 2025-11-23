/**
 * CDN URL utilities
 * Constructs full CDN URLs from relative paths
 */

const CDN_BASE_URL = 'https://oeptest.b-cdn.net/';

/**
 * Constructs full CDN URL from a relative path
 * @param path - Relative path from database (e.g., "/gallery/product.png")
 * @returns Full CDN URL or empty string if path is missing
 */
export function getCdnUrl(path: string | undefined | null): string {
  if (!path) return '';
  
  // If already a full URL, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Construct full CDN URL
  return `${CDN_BASE_URL}${cleanPath}`;
}

/**
 * Get CDN base URL
 */
export function getCdnBaseUrl(): string {
  return CDN_BASE_URL;
}

/**
 * Check if a URL is a CDN URL
 */
export function isCdnUrl(url: string): boolean {
  return url.startsWith(CDN_BASE_URL);
}

/**
 * Extract path from CDN URL
 * @param url - Full CDN URL
 * @returns Relative path
 */
export function extractPathFromCdnUrl(url: string): string {
  if (url.startsWith(CDN_BASE_URL)) {
    return url.slice(CDN_BASE_URL.length);
  }
  return url;
}
