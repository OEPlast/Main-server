import cron from 'node-cron';
import VyluxService from '@/services/vylux/VyluxService';
import { logger } from '@/lib/logger';

/** A form left open this long has been abandoned; its unused copies can go. */
const KEEP_MS = 3 * 24 * 60 * 60 * 1000;
let running = false;

async function runVyluxDraftCleanup(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const { drafts, deletedFiles } = await VyluxService.cleanupDrafts(KEEP_MS);
    if (drafts > 0) logger.info(`[vylux-drafts] ${drafts} expired: ${deletedFiles} unused files deleted`);
  } catch (error) {
    logger.error('[vylux-drafts] cleanup failed:', error);
  } finally {
    running = false;
  }
}

/** Hourly, and only on deployments with the Vylux import (Doreti); a no-op everywhere else. */
export function startVyluxDraftCleanup(): void {
  if (!VyluxService.isConfigured()) return;
  cron.schedule('15 * * * *', () => {
    void runVyluxDraftCleanup();
  });
  logger.info('[vylux-drafts] Started: hourly');
}
