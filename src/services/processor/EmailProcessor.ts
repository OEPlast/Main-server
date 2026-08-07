import { Mailer } from '@rawura/emails';
import { logger } from '@/lib/logger';
import { getBrand } from '@/services/email/brand';
import { isMarketingAllowed } from '@/services/email/consent';
import { signUnsubscribeToken } from '@/utils/unsubscribeToken';

/**
 * Main-server's email entry point.
 *
 * All templates, payload types, subject lines, plain-text bodies and the SMTP transport now
 * live in `@rawura/emails`, shared with event-bus. This file holds only what is specific to
 * this service: where brand values come from, and where to log.
 *
 * Call it as `EmailProcessor.send('order-confirmation', payload)` — the kind is checked
 * against the payload type at compile time, so a template can no longer be handed data it
 * does not render.
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
