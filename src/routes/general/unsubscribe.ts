import { Router, Request, Response } from 'express';
import User from '@/models/User';
import { logger } from '@/lib/logger';
import { verifyUnsubscribeToken } from '@/utils/unsubscribeToken';
import { getBrand } from '@/services/email/brand';

/**
 * Marketing email opt-out.
 *
 * Backs the unsubscribe link in email footers, which previously pointed at `href="#"` and did
 * nothing. Unauthenticated by design — the recipient of a marketing email should not have to
 * log in to stop receiving it — but the HMAC in the link proves the request originated from
 * an email we sent.
 *
 * Transactional email (receipts, shipping, security) is unaffected and always sends.
 */
const router = Router();

function page(title: string, body: string, accent: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>
 :root{color-scheme:light dark}
 body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
      font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
      background:#f2f4f7;color:#1B1B1B;padding:24px}
 .card{background:#fff;max-width:460px;width:100%;padding:32px;border-radius:14px;
       box-shadow:0 1px 3px rgba(16,24,40,.1);text-align:center}
 h1{margin:0 0 12px;font-size:22px;color:${accent}}
 p{margin:0 0 8px;color:#475467;font-size:15px}
 @media (prefers-color-scheme:dark){body{background:#0f1113;color:#e8eaed}
   .card{background:#1a1d21;box-shadow:none}p{color:#a1a5ab}}
</style></head><body><div class="card"><h1>${title}</h1>${body}</div></body></html>`;
}

router.get('/', async (req: Request, res: Response) => {
  const email = String(req.query.email ?? '');
  const token = String(req.query.token ?? '');

  if (!verifyUnsubscribeToken(email, token)) {
    return res
      .status(400)
      .type('html')
      .send(page('This link is not valid', '<p>It may have been altered or truncated by your email client.</p>', '#b42318'));
  }

  try {
    const brand = await getBrand();

    await User.updateOne(
      { email: email.toLowerCase() },
      { $set: { 'emailPreferences.marketing': false, 'emailPreferences.unsubscribedAt': new Date() } }
    );

    // Always report success, even when no account matched. Reporting "no such user" here
    // would turn this open endpoint into an account-enumeration oracle.
    logger.info(`[email] marketing opt-out recorded for ${email}`);

    return res.type('html').send(
      page(
        "You're unsubscribed",
        `<p>We will not send <strong>${email}</strong> any more marketing email.</p>
         <p>You will still receive order confirmations, delivery updates and account security notices.</p>
         <p><a href="${brand.storefrontUrl}/my-account" style="color:#6f9420">Manage all your email preferences</a></p>`,
        '#6f9420'
      )
    );
  } catch (error) {
    logger.error('Failed to record unsubscribe:', error);
    return res
      .status(500)
      .type('html')
      .send(page('Something went wrong', '<p>Please try again, or reply to any of our emails and we will do it for you.</p>', '#b42318'));
  }
});

/**
 * RFC 8058 one-click unsubscribe. Mail clients POST here directly from the
 * `List-Unsubscribe-Post` header, without the customer ever seeing a page.
 */
router.post('/', async (req: Request, res: Response) => {
  const email = String(req.query.email ?? '');
  const token = String(req.query.token ?? '');

  if (!verifyUnsubscribeToken(email, token)) return res.status(400).json({ message: 'Invalid link' });

  try {
    await User.updateOne(
      { email: email.toLowerCase() },
      { $set: { 'emailPreferences.marketing': false, 'emailPreferences.unsubscribedAt': new Date() } }
    );
    logger.info(`[email] one-click marketing opt-out recorded for ${email}`);
    return res.status(200).json({ message: 'Unsubscribed' });
  } catch (error) {
    logger.error('Failed to record one-click unsubscribe:', error);
    return res.status(500).json({ message: 'Failed to unsubscribe' });
  }
});

export default router;
