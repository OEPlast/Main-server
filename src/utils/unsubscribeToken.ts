import crypto from 'crypto';

/**
 * Signed, stateless unsubscribe tokens.
 *
 * An unsubscribe link lands in an inbox and lives there forever, so it must not carry a
 * session token or anything else that could be replayed against the account. An HMAC over
 * the address alone is enough: it proves the link came from us, grants nothing but the
 * ability to stop marketing email to that address, and needs no storage.
 */

const SECRET = process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || process.env.INTERNAL_SERVICE_KEY || '';

function normalise(email: string): string {
  return email.trim().toLowerCase();
}

export function signUnsubscribeToken(email: string): string {
  return crypto.createHmac('sha256', SECRET).update(normalise(email)).digest('base64url');
}

/** Constant-time comparison, so the endpoint cannot be used as a signing oracle. */
export function verifyUnsubscribeToken(email: string, token: string): boolean {
  if (!email || !token) return false;

  const expected = Buffer.from(signUnsubscribeToken(email));
  const provided = Buffer.from(token);

  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}
