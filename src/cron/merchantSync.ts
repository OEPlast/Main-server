import cron from 'node-cron';
import MerchantApiService from '@/services/MerchantApiService';

/**
 * Periodic full product sync to Google Merchant Center via the Merchant API.
 * Handles "frequent updates" (price/availability refresh) at a cadence.
 *
 * Cadence is configurable via GOOGLE_MERCHANT_SYNC_CRON (default: every 6 hours).
 * No-op unless the Merchant API is configured, so it is always safe to start.
 *
 * For true real-time freshness, also call MerchantApiService.upsertProduct(...)
 * from the product create/update path (event-driven) — this cron is the safety net.
 */
export function startMerchantSync(): void {
  if (!MerchantApiService.isConfigured()) {
    console.log('[merchant-sync] Skipped — Merchant API not configured.');
    return;
  }

  const schedule = process.env.GOOGLE_MERCHANT_SYNC_CRON || '0 */6 * * *';

  cron.schedule(schedule, () => {
    MerchantApiService.syncAllProducts()
      .then((result) =>
        console.log(
          `[merchant-sync] done — total:${result.total} ok:${result.succeeded} failed:${result.failed}`
        )
      )
      .catch((err) => console.error('[merchant-sync] Unhandled error:', err));
  });

  console.log(`[merchant-sync] Started with schedule "${schedule}".`);
}
