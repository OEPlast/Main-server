import type { BrandAddress, BrandInput, BrandSocialLinks, ResolvedSocialLink, StoreBrand } from './types';

/**
 * Brand resolution.
 *
 * Moved here from `@rawura/emails` (v1.0.1 `src/branding.ts`); Main-server owns brand.
 *
 * Every brand value has three sources, in priority order:
 *   1. the store `Settings` document (loaded in `./index.ts`),
 *   2. an environment variable,
 *   3. a hardcoded fallback.
 *
 * A missing Settings document therefore degrades to env values rather than to a blank header.
 * `whatsappNumber` is the exception: it comes from Settings only and has no env fallback.
 */

const SOCIAL_ICONS: Record<keyof BrandSocialLinks, { name: string; iconUrl: string }> = {
  x: {
    name: 'X',
    iconUrl:
      'https://res.cloudinary.com/dau2gxgbw/image/upload/v1676965510/email-template/images/twitter-icon_irb5ks.png',
  },
  facebook: {
    name: 'Facebook',
    iconUrl:
      'https://res.cloudinary.com/dau2gxgbw/image/upload/v1676965509/email-template/images/fb-icon_jdwajr.png',
  },
  instagram: {
    name: 'Instagram',
    iconUrl:
      'https://res.cloudinary.com/dau2gxgbw/image/upload/v1676965510/email-template/images/ig-icon_lyd5yy.png',
  },
  whatsapp: { name: 'WhatsApp', iconUrl: '' },
  threads: { name: 'Threads', iconUrl: '' },
};

function firstNonEmpty(...values: Array<string | undefined | null>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
}

/** Strips any trailing slash so `${storefrontUrl}/path` never produces a double slash. */
export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function formatAddress(address: BrandAddress): string {
  return [address.line1, address.line2, address.city, address.state, address.zip, address.country]
    .map((part) => (part ?? '').trim())
    .filter((part) => part.length > 0)
    .join(', ');
}

function resolveSocial(social: BrandSocialLinks | undefined): ResolvedSocialLink[] {
  if (!social) return [];

  // Ordered deliberately: the icons we actually have artwork for come first, and any
  // network without a configured URL is dropped rather than rendered as href="#".
  const order: Array<keyof BrandSocialLinks> = ['instagram', 'facebook', 'x', 'whatsapp', 'threads'];

  return order
    .map((key) => {
      const url = firstNonEmpty(social[key]);
      const meta = SOCIAL_ICONS[key];
      if (!url || !meta.iconUrl) return null;
      return { name: meta.name, url, iconUrl: meta.iconUrl };
    })
    .filter((link): link is ResolvedSocialLink => link !== null);
}

/**
 * Merges Settings-supplied brand values with environment defaults.
 *
 * `STOREFRONT_URL` is checked before `FRONTEND_URL` to match the fallback chain already used
 * by `FeedService` and `MerchantApiService`.
 */
export function resolveBrand(input: BrandInput = {}): StoreBrand {
  const env = process.env;

  const storeName = firstNonEmpty(input.storeName, env.STORE_NAME, 'Rawura');
  const address: BrandAddress = {
    line1: firstNonEmpty(input.address?.line1, env.STORE_ADDRESS),
    line2: firstNonEmpty(input.address?.line2),
    city: firstNonEmpty(input.address?.city, env.STORE_CITY),
    state: firstNonEmpty(input.address?.state, env.STORE_STATE),
    zip: firstNonEmpty(input.address?.zip),
    country: firstNonEmpty(input.address?.country, env.STORE_COUNTRY, 'Nigeria'),
  };

  const social = resolveSocial(input.social);

  return {
    storeName,
    companyName: firstNonEmpty(input.companyName, env.COMPANY_NAME, storeName),
    logoUrl: firstNonEmpty(input.logoUrl, env.STORE_LOGO_URL),
    storefrontUrl: normalizeBaseUrl(
      firstNonEmpty(input.storefrontUrl, env.STOREFRONT_URL, env.FRONTEND_URL, 'https://www.rawura.com')
    ),
    apiUrl: normalizeBaseUrl(firstNonEmpty(input.apiUrl, env.PUBLIC_API_URL, env.API_URL)),
    supportEmail: firstNonEmpty(input.supportEmail, env.SUPPORT_EMAIL, env.FROM_EMAIL, 'support@rawura.com'),
    supportPhone: firstNonEmpty(input.supportPhone, env.SUPPORT_PHONE, env.STORE_PHONE),
    // Settings document only — deliberately no env fallback.
    whatsappNumber: firstNonEmpty(input.whatsappNumber),
    address,
    addressLine: formatAddress(address),
    social,
    hasSocial: social.length > 0,
    year: new Date().getFullYear(),
  };
}
