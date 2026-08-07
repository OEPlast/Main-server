import Settings from '@/models/Settings';
import { resolveBrand, type Brand, type BrandInput } from '@rawura/emails';
import { logger } from '@/lib/logger';

/**
 * Brand values for outgoing email, read from the store `Settings` document.
 *
 * Cached: the previous implementation ran `Settings.findOne()` on every single send, on the
 * order-confirmation hot path. A minute of staleness on a logo URL costs nothing.
 */

const TTL_MS = 60_000;

let cached: { brand: Brand; expiresAt: number } | null = null;

/** `lean()` returns `string | null` for optional fields; the brand resolver wants `undefined`. */
const str = (value: string | null | undefined): string | undefined => value ?? undefined;

async function loadSettings(): Promise<BrandInput> {
  const settings = await Settings.findOne().lean();
  if (!settings) return {};

  return {
    storeName: str(settings.storeName),
    companyName: str(settings.companyName),
    logoUrl: str(settings.logoUrl),
    storefrontUrl: str(settings.websiteUrl),
    supportEmail: str(settings.supportEmail),
    supportPhone: str(settings.supportPhone),
    address: settings.address
      ? {
          line1: str(settings.address.line1),
          line2: str(settings.address.line2),
          city: str(settings.address.city),
          state: str(settings.address.state),
          zip: str(settings.address.zip),
          country: str(settings.address.country),
        }
      : undefined,
    social: settings.socialLinks
      ? {
          instagram: str(settings.socialLinks.instagram),
          facebook: str(settings.socialLinks.facebook),
          whatsapp: str(settings.socialLinks.whatsapp),
          x: str(settings.socialLinks.x),
          threads: str(settings.socialLinks.threads),
        }
      : undefined,
  };
}

/**
 * Returns the resolved brand.
 *
 * A failure to read Settings degrades to environment defaults rather than propagating —
 * an email with a slightly generic footer is better than an order confirmation that never
 * sends.
 */
export async function getBrand(): Promise<Brand> {
  if (cached && cached.expiresAt > Date.now()) return cached.brand;

  let input: BrandInput = {};
  try {
    input = await loadSettings();
  } catch (error) {
    logger.warn('[email] could not read store Settings; falling back to environment branding', error);
  }

  const brand = resolveBrand(input);
  cached = { brand, expiresAt: Date.now() + TTL_MS };
  return brand;
}

/** Drops the cache. Call after Settings are edited so the change shows up immediately. */
export function invalidateBrandCache(): void {
  cached = null;
}
