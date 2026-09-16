import User from '@/models/User';
import NewsletterSubscriber from '@/models/NewsletterSubscriber';
import { logger } from '@/lib/logger';
import { EMAIL_COLLATION } from './newsletter';

/**
 * Marketing-email consent lookup, consulted by the mailer before any marketing send.
 *
 * Transactional email never reaches this — an order confirmation is not something a customer
 * can be opted out of.
 *
 * Matches case-insensitively: accounts created before emails were normalised keep their original
 * casing, and an exact lowercase match silently treated those customers as "no account", so their
 * opt-out was ignored.
 */
export async function isMarketingAllowed(email: string): Promise<boolean> {
  const normalised = email.trim().toLowerCase();
  const [user, subscriber] = await Promise.all([
    User.findOne({ email: normalised }).collation(EMAIL_COLLATION).select('emailPreferences').lean(),
    NewsletterSubscriber.findOne({ email: normalised }).select('status').lean(),
  ]);

  if (user?.emailPreferences?.marketing === false || subscriber?.status === 'unsubscribed') {
    logger.info(`[email] ${email} has opted out of marketing email`);
    return false;
  }

  // No account and no subscription row means no relationship to have opted out of; the send site
  // is responsible for having a lawful reason to write to the address in the first place.
  return true;
}
