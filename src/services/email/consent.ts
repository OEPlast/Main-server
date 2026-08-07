import User from '@/models/User';
import { logger } from '@/lib/logger';

/**
 * Marketing-email consent lookup, consulted by the mailer before any marketing send.
 *
 * Transactional email never reaches this — an order confirmation is not something a customer
 * can be opted out of.
 */
export async function isMarketingAllowed(email: string): Promise<boolean> {
  const user = await User.findOne({ email: email.toLowerCase() }).select('emailPreferences').lean();

  // No account on file means no relationship to have opted out of; the send site is
  // responsible for having a lawful reason to write to the address in the first place.
  if (!user) return true;

  const allowed = user.emailPreferences?.marketing !== false;
  if (!allowed) logger.info(`[email] ${email} has opted out of marketing email`);

  return allowed;
}
