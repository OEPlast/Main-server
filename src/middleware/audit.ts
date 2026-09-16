import type { NextFunction, Request, Response } from 'express';
import AdminAuditLog from '@/models/AdminAuditLog';
import type { AuthenticatedRequest } from '@/types';
import { logger } from '@/lib/logger';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SECRET_KEY = /pass|secret|token|otp|code|key|authorization/i;
const MAX_STRING = 500;
const MAX_ARRAY = 50;
const OBJECT_ID = /^[a-f\d]{24}$/i;

/** Copies a request body for the log, dropping secrets and trimming anything large. */
export function sanitizeForAudit(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[nested]';
  if (Array.isArray(value)) {
    const trimmed = value.slice(0, MAX_ARRAY).map((v) => sanitizeForAudit(v, depth + 1));
    return value.length > MAX_ARRAY ? [...trimmed, `[+${value.length - MAX_ARRAY} more]`] : trimmed;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEY.test(key) ? '[redacted]' : sanitizeForAudit(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > MAX_STRING) {
    return `${value.slice(0, MAX_STRING)}… [${value.length} chars]`;
  }
  return value;
}

/**
 * Records every successful state-changing admin request.
 *
 * Mounted once on /admin ahead of the admin routers. It reads the actor when the response
 * finishes, by which point the router's authenticateUser has run, so it needs nothing from the
 * individual routes. Only 2xx/3xx responses are logged: a refused request changed nothing.
 * Logging failures never affect the response.
 */
export function auditAdminMutations(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING_METHODS.has(req.method)) return next();

  const startedAt = Date.now();
  // Captured now: the body may be reassigned by validators, and the path is stable here.
  const body = sanitizeForAudit(req.body);
  const query = sanitizeForAudit(req.query);
  const path = req.originalUrl.split('?')[0];

  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    const { userId, role } = req as AuthenticatedRequest;
    if (!userId) return;

    const segments = path.replace(/^\/admin\/?/, '').split('/').filter(Boolean);
    const resource = segments[0] ?? 'unknown';
    const targetId = segments.find((s) => OBJECT_ID.test(s));

    AdminAuditLog.create({
      actor: { userId, role },
      method: req.method,
      path,
      resource,
      targetId,
      body,
      query,
      statusCode: res.statusCode,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.get('x-request-id'),
      durationMs: Date.now() - startedAt,
    }).catch((error) => logger.error('Audit log write failed:', error));
  });

  next();
}
