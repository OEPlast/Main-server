import User from '@/models/User';
import NewsletterSubscriber from '@/models/NewsletterSubscriber';
import { logger } from '@/lib/logger';

/** Case-insensitive email match; older accounts were stored with their original casing. */
export const EMAIL_COLLATION = { locale: 'en', strength: 2 } as const;

/**
 * Records a newsletter opt-in.
 *
 * A signed-in customer's own account is updated. Otherwise the address is upserted as a
 * NewsletterSubscriber, linked to a matching account when there is one (which is also opted back
 * in, since they have just asked for marketing email from that address).
 */
export async function subscribeToNewsletter(input: { email: string; userId?: string; source: string }): Promise<void> {
  const now = new Date();
  const email = input.email.trim().toLowerCase();

  if (input.userId) {
    await User.updateOne(
      { _id: input.userId },
      {
        $set: {
          'emailPreferences.marketing': true,
          'emailPreferences.unsubscribedAt': null,
          'emailPreferences.subscribedAt': now,
          'emailPreferences.source': input.source,
        },
      }
    );
    logger.info(`[newsletter] account ${input.userId} opted in via ${input.source}`);
    return;
  }

  const account = await User.findOne({ email }).collation(EMAIL_COLLATION).select('_id').lean();
  if (account) {
    await User.updateOne(
      { _id: account._id },
      {
        $set: {
          'emailPreferences.marketing': true,
          'emailPreferences.unsubscribedAt': null,
          'emailPreferences.subscribedAt': now,
          'emailPreferences.source': input.source,
        },
      }
    );
  }

  await NewsletterSubscriber.updateOne(
    { email },
    {
      $set: { status: 'subscribed', subscribedAt: now, unsubscribedAt: null, source: input.source, user: account?._id ?? null },
    },
    { upsert: true }
  );
  logger.info(`[newsletter] ${email} subscribed via ${input.source}`);
}

/** Opts an address out of marketing email everywhere it is recorded. */
export async function unsubscribeEverywhere(emailInput: string): Promise<void> {
  const email = emailInput.trim().toLowerCase();
  const now = new Date();
  await Promise.all([
    User.updateOne(
      { email },
      { $set: { 'emailPreferences.marketing': false, 'emailPreferences.unsubscribedAt': now } }
    ).collation(EMAIL_COLLATION),
    NewsletterSubscriber.updateOne({ email }, { $set: { status: 'unsubscribed', unsubscribedAt: now } }),
  ]);
}
