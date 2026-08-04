import type { Request } from 'express';
import morgan from 'morgan';
import { accessLogger } from '@/lib/logger';

// Build the morgan middleware
export const morganMiddleware = morgan(':method :url :status :res[content-length] - :response-time ms');

/**
 * Who made the call.
 *
 * `authenticateUser` sets these on the request, and morgan evaluates its tokens
 * when the response finishes rather than when it arrives, so by this point the
 * auth middleware has run. That ordering is what lets the access log answer the
 * question the legacy-endpoint retirement depends on: did anything other than a
 * signed-in admin ever call this route?
 */
morgan.token('userId', (req) => (req as Request & { userId?: string }).userId ?? '-');
morgan.token('role', (req) => (req as Request & { role?: string }).role ?? '-');

/**
 * Access-log middleware — one JSON line per request into `logs/access.log`.
 *
 * Kept separate from `morganMiddleware` rather than replacing it: the console
 * line stays human-readable for development, while this one stays machine-
 * readable for `grep`/`jq` weeks later.
 */
export const morganAccessLog = morgan(
  (tokens, req, res) =>
    JSON.stringify({
      t: new Date().toISOString(),
      method: tokens.method(req, res),
      url: tokens.url(req, res),
      status: Number(tokens.status(req, res)),
      ms: Number(tokens['response-time'](req, res)),
      userId: tokens.userId(req, res),
      role: tokens.role(req, res),
      ip: tokens['remote-addr'](req, res),
      ua: tokens['user-agent'](req, res),
    }),
  {
    stream: {
      write: (line: string) => {
        accessLogger.http(line.trim());
      },
    },
  }
);

// @chocoscoding look at this later
