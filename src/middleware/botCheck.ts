import axios from 'axios';
import { NextFunction, Request, Response } from 'express';
import { logger } from '@/lib/logger';

/**
 * Bot check for public forms that send email (signup first). Off unless configured, so a store
 * whose storefront doesn't send these fields (Rawura) is unaffected:
 *
 * - `TURNSTILE_SECRET_KEY`: the request must carry a Cloudflare Turnstile token (`turnstileToken`)
 *   that Cloudflare confirms. If Cloudflare can't be reached the request is let through (logged),
 *   so an outage there never locks real customers out.
 * - `BOT_FORM_CHECKS=true`: the storefront's hidden `website` field must be empty (only bots fill
 *   it) and the form must have been open for at least 2 seconds (`formStartedAt`, epoch ms).
 *
 * Bots get the same generic message as a failed check, without saying which one tripped.
 */
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MIN_FILL_MS = 2000;
/** A form start older than this is a stale tab or a forged value; either way it doesn't count as "slow". */
const MAX_FILL_MS = 24 * 60 * 60 * 1000;

const reject = (res: Response, reason: string, req: Request) => {
  logger.warn(`[bot-check] rejected ${req.method} ${req.originalUrl}: ${reason}`, { ip: req.ip });
  return res.status(400).json({ message: 'We couldn’t confirm you’re human. Please refresh the page and try again.' });
};

async function turnstilePasses(token: string, ip: string | undefined, secret: string): Promise<boolean> {
  try {
    const body = new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) });
    const { data } = await axios.post<{ success: boolean; 'error-codes'?: string[] }>(VERIFY_URL, body, { timeout: 5000 });
    if (!data.success) logger.warn(`[bot-check] turnstile said no: ${(data['error-codes'] ?? []).join(',')}`);
    return data.success;
  } catch (error) {
    logger.warn(`[bot-check] turnstile unreachable, letting the request through: ${error instanceof Error ? error.message : error}`);
    return true;
  }
}

export async function botCheck(req: Request, res: Response, next: NextFunction) {
  const body = (req.body ?? {}) as Record<string, unknown>;

  if (process.env.BOT_FORM_CHECKS === 'true') {
    if (typeof body.website === 'string' && body.website.trim() !== '') return reject(res, 'honeypot filled', req);
    const started = Number(body.formStartedAt);
    const elapsed = Date.now() - started;
    if (!Number.isFinite(started) || elapsed < MIN_FILL_MS || elapsed > MAX_FILL_MS) return reject(res, `form timing (${elapsed}ms)`, req);
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (secret) {
    const token = typeof body.turnstileToken === 'string' ? body.turnstileToken : '';
    if (!token) return reject(res, 'no turnstile token', req);
    if (!(await turnstilePasses(token, req.ip, secret))) return reject(res, 'turnstile failed', req);
  }

  next();
}
