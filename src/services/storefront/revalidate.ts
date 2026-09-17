/**
 * Tells the storefront to drop cached pages after a write.
 *
 * The storefront serves its pages from Next.js's ISR cache and regenerates them every 12 hours.
 * That schedule is the *backstop*; this module is the mechanism. When a price changes, a product is
 * renamed or a sale starts, we POST the affected cache tags to the storefront's
 * `/api/revalidate` route, and the pages built from those tags regenerate on their next visit.
 *
 * Design notes, all of which exist because this runs on the hot path of admin writes:
 *
 *  - **Fire and forget.** Callers never await it and it never throws. A storefront that is down
 *    must not fail a product save; the worst case is that a page stays stale until its 12-hour
 *    revalidation, which is exactly where we were before.
 *  - **Debounced.** Saving a product touches several code paths (details, then cover image, then
 *    tags). Tags are collected in a set and sent 2 seconds after the last call, with a hard ceiling
 *    of 10 seconds so a stream of edits can't postpone the flush forever.
 *  - **Retried.** Network errors and 5xx are retried at 1s, 5s and 15s. A 4xx is not — that means
 *    we sent a tag the storefront's allowlist rejects, and retrying won't fix it.
 *  - **Call it after the write commits.** Inside a transaction the storefront would refetch the
 *    old data and cache it again.
 *
 * Configure with `STOREFRONT_REVALIDATE_TAGS_URL` (e.g. `https://www.rawura.com/api/revalidate`)
 * and the shared `REVALIDATE_SECRET`. With either unset this is a no-op, so local development and
 * any environment without a storefront just work.
 *
 * The tag vocabulary is defined in `storefront/src/libs/api/cacheTags.ts` and enforced by the
 * route's allowlist — keep the three in step.
 */
import { logger } from '@/lib/logger';

export const StorefrontTag = {
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  CAMPAIGNS: 'campaigns',
  BANNERS: 'banners',
  INTENTS: 'intents',
  BRANDING: 'branding',
  DELIVERY_CONFIG: 'delivery-config',
} as const;

export const productTag = (slug: string) => `product:${slug}`;
export const categoryTag = (slug: string) => `category:${slug}`;
export const campaignTag = (slug: string) => `campaign:${slug}`;
export const intentTag = (slug: string) => `intent:${slug}`;

const DEBOUNCE_MS = 2_000;
const MAX_WAIT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 5_000;
const RETRY_DELAYS_MS = [1_000, 5_000, 15_000];
/** The storefront route rejects anything larger. */
const MAX_TAGS_PER_REQUEST = 100;

let pending = new Set<string>();
let flushTimer: NodeJS.Timeout | null = null;
let firstQueuedAt = 0;

const config = () => ({
  url: process.env.STOREFRONT_REVALIDATE_TAGS_URL,
  secret: process.env.REVALIDATE_SECRET,
});

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function postTags(tags: string[], url: string, secret: string): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Revalidate-Secret': secret },
        body: JSON.stringify({ tags }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.ok) {
        logger.info(`[revalidate] ok tags=${tags.join(',')}`);
        return;
      }
      // A 4xx is our mistake (unknown tag, bad secret) and will fail identically next time.
      if (response.status < 500) {
        logger.warn(`[revalidate] rejected (${response.status}) tags=${tags.join(',')}: ${await response.text().catch(() => '')}`);
        return;
      }
      if (attempt >= RETRY_DELAYS_MS.length) {
        logger.warn(`[revalidate] gave up after ${attempt + 1} attempts (${response.status}) tags=${tags.join(',')}`);
        return;
      }
    } catch (error) {
      if (attempt >= RETRY_DELAYS_MS.length) {
        logger.warn(`[revalidate] gave up after ${attempt + 1} attempts tags=${tags.join(',')}: ${(error as Error).message}`);
        return;
      }
    }
    await sleep(RETRY_DELAYS_MS[attempt]!);
  }
}

/** Sends whatever has been queued. Safe to call when nothing is pending. */
export async function flushStorefrontRevalidation(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pending.size === 0) return;

  const tags = [...pending];
  pending = new Set();
  firstQueuedAt = 0;

  const { url, secret } = config();
  if (!url || !secret) return;

  await Promise.all(chunk(tags, MAX_TAGS_PER_REQUEST).map((batch) => postTags(batch, url, secret)));
}

/**
 * Queue cache tags for purging. Returns immediately; the request goes out a couple of seconds
 * later. Duplicate tags across calls are collapsed.
 */
export function requestStorefrontRevalidation(tags: Array<string | null | undefined>): void {
  const { url, secret } = config();
  if (!url || !secret) return;

  let added = false;
  for (const tag of tags) {
    if (typeof tag === 'string' && tag.length > 0 && !pending.has(tag)) {
      pending.add(tag);
      added = true;
    }
  }
  if (!added) return;

  const now = Date.now();
  if (firstQueuedAt === 0) firstQueuedAt = now;

  // Reset the debounce, but never push the send past MAX_WAIT_MS from the first queued tag.
  const remainingCeiling = Math.max(0, firstQueuedAt + MAX_WAIT_MS - now);
  const delay = Math.min(DEBOUNCE_MS, remainingCeiling);

  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    void flushStorefrontRevalidation();
  }, delay);
  // Don't hold the process open just for a pending purge; `flushStorefrontRevalidation` is called
  // explicitly during shutdown.
  flushTimer.unref?.();
}
