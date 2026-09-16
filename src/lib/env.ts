/**
 * Startup check of the environment. Imported second in server.ts, right after dotenv, so it runs
 * before any module reads process.env at load time.
 *
 * Missing required values stop the process with one message naming all of them, instead of the
 * previous behaviour: some modules threw one at a time at import, PEPPER_SECRET failed silently
 * (passwords were peppered with the string "undefined"), and PAYSTACK_SECRET_KEY was only
 * discovered missing by the first customer who tried to pay.
 */

const REQUIRED = [
  ['MONGODB_URI', 'database connection string'],
  ['JWT_SECRET', 'signs every session token'],
  ['INTERNAL_SERVICE_KEY', 'shared secret for event-bus and the websocket gateway'],
  ['PEPPER_SECRET', 'mixed into every password hash'],
  ['PAYSTACK_SECRET_KEY', 'payments, refunds and webhook signatures'],
] as const;

/** Missing these does not stop the server, but a feature is off or falls back to a localhost default. */
const RECOMMENDED = [
  ['RABBITMQ_URL', 'events to event-bus and the websocket gateway (defaults to localhost)'],
  ['CORS_ORIGINS', 'browser origins allowed to call the API (defaults to localhost)'],
  ['STOREFRONT_URL', 'links in emails (defaults to https://www.rawura.com)'],
  ['GOOGLE_CLIENT_ID', 'Google sign-in refuses every login without it'],
  ['CDN_BASE_URL', 'image URLs (defaults to the test CDN)'],
  ['PUBLIC_API_URL', 'unsubscribe links in marketing email and the newsletter (omitted when unset)'],
  ['UNSUBSCRIBE_SECRET', 'signs unsubscribe links (falls back to INTERNAL_SERVICE_KEY)'],
  ['SMTP_HOST', 'outgoing email'],
  ['FROM_EMAIL', 'sender address on every email'],
] as const;

export function validateEnv(): void {
  const missing = REQUIRED.filter(([name]) => !process.env[name]?.trim());
  if (missing.length > 0) {
    const lines = missing.map(([name, why]) => `  - ${name}: ${why}`).join('\n');
    // eslint-disable-next-line no-console
    console.error(`Refusing to start: required environment variables are missing.\n${lines}`);
    process.exit(1);
  }

  const absent = RECOMMENDED.filter(([name]) => !process.env[name]?.trim());
  for (const [name, why] of absent) {
    // eslint-disable-next-line no-console
    console.warn(`[env] ${name} is not set: ${why}`);
  }

  if (process.env.NODE_ENV === 'production' && !process.env.TRUST_PROXY) {
    // eslint-disable-next-line no-console
    console.warn('[env] TRUST_PROXY is not set: behind a load balancer, rate limits will apply per proxy, not per client');
  }
}

validateEnv();
