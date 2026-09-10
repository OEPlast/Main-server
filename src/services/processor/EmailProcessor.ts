import { Mailer } from '@rawura/emails';
import { logger } from '@/lib/logger';
import { getBrand } from '@/services/brand';
import { isMarketingAllowed } from '@/services/email/consent';
import { signUnsubscribeToken } from '@/utils/unsubscribeToken';

/**
 * Main-server's email entry point.
 *
 * Templates, subject lines, plain-text bodies and the SMTP transport live in `@rawura/emails`,
 * shared with event-bus. This file holds only what is specific to this service: where brand
 * values come from (Main-server owns brand — `@/services/brand`), and where to log.
 *
 * This is the ONLY place Main-server imports from `@rawura/emails`. Payload types are
 * duplicated locally in `@/types/emailPayloads`.
 *
 * Call it as `EmailProcessor.send('order-confirmation', payload)` — the kind is checked
 * against the package's payload type at compile time, so a template can no longer be handed
 * data it does not render, and a drifted local payload type is a build error here.
 */
const EmailProcessor = new Mailer({
  getBrand,
  isMarketingAllowed,
  signUnsubscribe: signUnsubscribeToken,
  logger: {
    info: (message, meta) => logger.info(message, meta),
    warn: (message, meta) => logger.warn(message, meta),
    error: (message, meta) => logger.error(message, meta),
  },
});

export default EmailProcessor;
