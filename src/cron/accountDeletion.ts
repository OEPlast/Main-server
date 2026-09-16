import cron from 'node-cron';
import User from '@/models/User';
import { anonymiseUser } from '@/services/users/accountDeletion';
import { logger } from '@/lib/logger';

const BATCH_SIZE = 50;
const RETRY_AFTER_MS = 24 * 60 * 60 * 1000;
let running = false;

/**
 * Carries out account deletions whose grace period has ended. State lives on the User
 * (`deletionScheduledFor`), so nothing is lost on restart. If something opened during the grace
 * period (an order or return in progress), the deletion is pushed back a day and tried again.
 */
async function runAccountDeletions(): Promise<void> {
  if (running) return;
  running = true;
  let deleted = 0;
  let postponed = 0;
  try {
    const due = await User.find({ deletionScheduledFor: { $lte: new Date() }, deletedAt: null })
      .sort({ deletionScheduledFor: 1 })
      .limit(BATCH_SIZE)
      .select('_id')
      .lean();

    for (const { _id } of due) {
      const userId = _id.toString();
      try {
        const result = await anonymiseUser(userId, { by: 'self' });
        if (result.code === 200) {
          deleted += 1;
          logger.info(`[account-deletion] anonymised user ${userId}`);
        } else if (result.code === 409) {
          postponed += 1;
          await User.updateOne({ _id }, { $set: { deletionScheduledFor: new Date(Date.now() + RETRY_AFTER_MS) } });
          logger.warn(`[account-deletion] postponed user ${userId}: ${result.message}`);
        }
      } catch (error) {
        logger.error(`[account-deletion] failed for user ${userId}:`, error);
      }
    }
    if (due.length > 0) logger.info(`[account-deletion] ${due.length} due: ${deleted} anonymised, ${postponed} postponed`);
  } catch (error) {
    logger.error('[account-deletion] run failed:', error);
  } finally {
    running = false;
  }
}

export function startAccountDeletions(): void {
  cron.schedule('45 * * * *', () => {
    void runAccountDeletions();
  });
  logger.info('[account-deletion] Started: hourly');
}
