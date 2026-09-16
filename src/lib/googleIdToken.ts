import { OAuth2Client, type TokenPayload } from 'google-auth-library';

const client = new OAuth2Client();

/**
 * The OAuth client IDs a Google ID token may be issued to. Comma-separated so the storefront and
 * admin can use different Google clients. Read per call so a missing value fails the login rather
 * than the whole server at boot.
 */
const allowedAudiences = (): string[] =>
  (process.env.GOOGLE_CLIENT_ID ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

/**
 * Verifies a Google ID token and returns its payload.
 *
 * This is what proves a provider login. The Google account id alone is not a secret: it is
 * visible to any app the person has signed into, so trusting it on its own let anyone mint a
 * session for any Google-linked account. The ID token is signed by Google for our client ID, and
 * `verifyIdToken` checks that signature, the audience, the issuer and the expiry.
 *
 * @throws when GOOGLE_CLIENT_ID is not configured or the token is invalid
 */
export async function verifyGoogleIdToken(idToken: string): Promise<TokenPayload> {
  const audience = allowedAudiences();
  if (audience.length === 0) {
    throw new Error('GOOGLE_CLIENT_ID is not set; Google sign-in cannot be verified');
  }

  const ticket = await client.verifyIdToken({ idToken, audience });
  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error('Google ID token has no payload');
  }
  return payload;
}
