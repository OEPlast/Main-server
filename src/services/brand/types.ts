/**
 * Store brand types. Owned by Main-server.
 *
 * Originally from `@rawura/emails` (v1.0.1 `src/branding.ts`). Brand is store configuration,
 * not an email concern, so Main-server — which owns the `Settings` document — owns these
 * types. They are deliberately NOT imported from the email package.
 *
 * Compatibility: `StoreBrand` must stay a structural SUPERSET of the package's brand shape.
 * `Mailer` is constructed with `getBrand` (see `services/processor/EmailProcessor.ts`), and
 * production installs `@rawura/emails` v1.0.1, whose `MailerOptions.getBrand` returns the full
 * v1.0.1 `Brand`. Removing or renaming any field below breaks that assignment at compile time.
 */

export interface BrandAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface BrandSocialLinks {
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
  x?: string;
  threads?: string;
}

/** What the Settings loader supplies. Everything is optional; the resolver fills the gaps. */
export interface BrandInput {
  storeName?: string;
  companyName?: string;
  logoUrl?: string;
  storefrontUrl?: string;
  /** Public base URL of the API that serves the unsubscribe endpoint. */
  apiUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  /** Store WhatsApp number. Read from the Settings document only; there is no env fallback. */
  whatsappNumber?: string;
  /** Free text, e.g. "Mon–Sat, 9am–6pm WAT". Settings only. */
  supportHours?: string;
  address?: BrandAddress;
  social?: BrandSocialLinks;
}

/** Policy figures the storefront quotes (returns page, FAQ, product page). */
export interface StorePolicies {
  returnWindowDays: number;
  refundEtaDays: number;
}

/** A social icon that survived resolution — i.e. one that has a real URL. */
export interface ResolvedSocialLink {
  name: string;
  url: string;
  iconUrl: string;
}

/** The fully-resolved store brand. */
export interface StoreBrand {
  storeName: string;
  companyName: string;
  logoUrl: string;
  storefrontUrl: string;
  /** Empty when no public API URL is configured; the footer then omits opt-out links. */
  apiUrl: string;
  supportEmail: string;
  supportPhone: string;
  /** Empty when the Settings document has no WhatsApp number. */
  whatsappNumber: string;
  /** Empty when not configured; surfaces then omit hours rather than guess. */
  supportHours: string;
  policies: StorePolicies;
  /** Raw social URLs for storefront surfaces such as the footer. */
  socialLinks: BrandSocialLinks;
  address: BrandAddress;
  /** Single-line postal address for the footer. Empty when nothing is configured. */
  addressLine: string;
  social: ResolvedSocialLink[];
  /** Templates use this instead of `{{#if social}}` so an empty array reads correctly. */
  hasSocial: boolean;
  year: number;
}
