import User from '@/models/User';
import { GuestCheckoutContact } from '@/types/order';

/**
 * Decides which user record a checkout belongs to.
 *
 * Signed in: the token's user, unchanged.
 *
 * Guest: a real User document with `isGuest: true` and no password, found or created by email.
 * Orders, transactions and coupon redemptions all require a user, and every downstream reader
 * (order emails, admin order views, analytics, per-customer coupon limits) goes through it — so a
 * guest gets a record rather than every one of those readers learning about user-less orders.
 *
 * An email that already belongs to a registered account is refused with ACCOUNT_EXISTS: the
 * shopper is asked to log in instead. Attaching the order silently would let anyone who knows an
 * email address put orders into that person's history and trigger emails to them.
 */

export const CHECKOUT_ACCOUNT_EXISTS = 'ACCOUNT_EXISTS';

export type CheckoutCustomerResult =
  | { ok: true; userId: string; isGuest: boolean }
  | { ok: false; code: number; message: string; reason?: typeof CHECKOUT_ACCOUNT_EXISTS; email?: string };

// Case-insensitive match. The unique index on User.email is case-sensitive and older accounts
// were stored as typed, so an exact lookup of "ada@x.com" would miss a registered "Ada@x.com" and
// quietly create a second, guest record for the same person.
const EMAIL_COLLATION = { locale: 'en', strength: 2 } as const;

const findByEmail = (email: string) =>
  User.findOne({ email }).collation(EMAIL_COLLATION).select('_id isGuest suspended');

const isDuplicateKeyError = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;

const resolveCheckoutCustomer = async ({
  userId,
  guest,
}: {
  userId?: string;
  guest?: GuestCheckoutContact;
}): Promise<CheckoutCustomerResult> => {
  if (userId) {
    return { ok: true, userId, isGuest: false };
  }

  if (!guest) {
    // The validator already rejects this; kept so the service is safe to call on its own.
    return { ok: false, code: 400, message: 'Contact details are required to check out as a guest.' };
  }

  const email = guest.email.trim().toLowerCase();
  const firstName = guest.firstName.trim();
  const lastName = guest.lastName.trim();

  const existing = await findByEmail(email);

  if (existing && !existing.isGuest) {
    return {
      ok: false,
      code: 409,
      reason: CHECKOUT_ACCOUNT_EXISTS,
      email,
      message: 'You already have an account with this email. Please log in to continue.',
    };
  }

  if (existing) {
    if (existing.suspended) {
      return { ok: false, code: 403, message: 'This email cannot be used to place orders. Please contact support.' };
    }

    // Keep the name current so order emails greet the shopper by the name they just typed.
    await User.updateOne({ _id: existing._id }, { $set: { firstName, lastName, name: `${firstName} ${lastName}` } });
    return { ok: true, userId: existing._id.toString(), isGuest: true };
  }

  try {
    const created = await User.create({ email, firstName, lastName, isGuest: true });
    return { ok: true, userId: created._id.toString(), isGuest: true };
  } catch (error) {
    // Two first-time guest checkouts for the same email at the same moment: both saw no user and
    // both tried to create one. The loser re-reads the winner's record.
    if (isDuplicateKeyError(error)) {
      const winner = await findByEmail(email);
      if (winner?.isGuest) {
        return { ok: true, userId: winner._id.toString(), isGuest: true };
      }
    }
    throw error;
  }
};

const CheckoutCustomerService = { resolveCheckoutCustomer };
export default CheckoutCustomerService;
