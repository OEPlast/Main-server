import User, { UserType } from '@/models/User';
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/types';
import jwt from 'jsonwebtoken';
import { createHash, timingSafeEqual } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('Set JWT secret');
}

const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY;
if (!INTERNAL_SERVICE_KEY) {
  throw new Error('Set INTERNAL_SERVICE_KEY in environment variables');
}

/**
 * Resolves the user behind a bearer token, or null when the token must not be honoured.
 *
 * Beyond the signature, a token is refused when its user is gone, suspended, or its `tv` no longer
 * matches the user's tokenVersion (bumped on password reset/change and on suspension). Tokens
 * issued before `tv` existed carry none and count as version 0, so existing sessions keep working
 * until the first bump. The user was already read here for its role, so this adds no query.
 */
const resolveTokenUser = async (token: string) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: UserType['role']; tv?: number };
    const user = await User.findById(decoded.userId, { role: true, suspended: true, tokenVersion: true });
    if (!user || user.suspended) return null;
    if ((decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) return null;
    return user;
  } catch {
    return null;
  }
};

/** Constant-time string comparison, so response timing reveals nothing about a secret. */
const safeEqual = (a: string, b: string): boolean =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  const user = await resolveTokenUser(token);
  if (!user) return res.status(401).json({ message: 'Invalid token' });

  (req as AuthenticatedRequest).userId = user._id.toString();
  (req as AuthenticatedRequest).role = user.role;
  return next();
};

/**
 * Optional authentication for routes that also serve guests (checkout).
 *
 * No Authorization header: continue as a guest. A header that IS sent must be valid, though —
 * unlike authenticateUser_No_Force, a bad or expired token is a 401 rather than a silent
 * downgrade. Otherwise a shopper whose session still looks signed in would be treated as a guest
 * and asked for contact details, instead of hitting the storefront's "Invalid token" re-login.
 */
export const authenticateUserIfTokenSent = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return next();
  }
  const user = await resolveTokenUser(token);
  if (!user) return res.status(401).json({ message: 'Invalid token' });

  (req as AuthenticatedRequest).userId = user._id.toString();
  (req as AuthenticatedRequest).role = user.role;
  return next();
};

//try authentication, go to the next phase if it auth is successful or not
export const authenticateUser_No_Force = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return next();
  }
  const user = await resolveTokenUser(token);
  if (!user) return next();

  (req as AuthenticatedRequest).userId = user._id.toString();
  (req as AuthenticatedRequest).role = user.role;
  return next();
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  if (!['owner', 'manager', 'employee'].includes(authReq.role || '')) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};

// Require a specific permission in the format of resource + action (e.g., 'inventory' + 'update')
export const requirePermission = (resource: string, action: string) => {
  type PopulatedRole = {
    isActive: boolean;
    permissions: Array<{ resource: string; actions: string[] }>;
  };
  return async (req: Request, res: Response, next: NextFunction) => {
    const { userId, role } = req as AuthenticatedRequest;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Owner bypass
    if (role === 'owner') {
      return next();
    }

    try {
      const user = await User.findById(userId)
        .select('roles')
        .populate({ path: 'roles', select: 'permissions isActive name' });

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const roles = (user as unknown as { roles: PopulatedRole[] }).roles;

      const allowed = roles?.some((r) => {
        if (!r?.isActive) return false;
        return r.permissions?.some((p) => {
          if (p.resource !== resource) return false;
          // Support exact action, 'all', or '*'
          return p.actions?.includes(action) || p.actions?.includes('all') || p.actions?.includes('*');
        });
      });

      if (!allowed) {
        return res.status(403).json({ message: `Forbidden: missing permission ${resource}:${action}` });
      }

      return next();
    } catch (err) {
      return res.status(500).json({ message: 'Permission check failed' });
    }
  };
};

/**
 * Verify internal service authentication for event-bus or other microservices
 * Checks X-Service-Key header and sets isInternalService flag to bypass rate limiting
 */
export const verifyInternalService = (req: Request, res: Response, next: NextFunction) => {
  const serviceKey = req.headers['x-service-key'] as string;

  if (!serviceKey) {
    return res.status(401).json({
      message: 'Internal service authentication required',
      code: 'MISSING_SERVICE_KEY',
    });
  }

  if (!safeEqual(serviceKey, INTERNAL_SERVICE_KEY)) {
    return res.status(403).json({
      message: 'Invalid service key',
      code: 'INVALID_SERVICE_KEY',
    });
  }

  // Set flag to bypass rate limiting
  (req as any).isInternalService = true;
  next();
};
