import User, { UserType } from '@/models/User';
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/types';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('Set JWT secret');
}

const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY;
if (!INTERNAL_SERVICE_KEY) {
  throw new Error('Set INTERNAL_SERVICE_KEY in environment variables');
}

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: UserType['role'] };
    const user = await User.findById(decoded.userId, { role: true });
    if (!user) return res.status(401).json({ message: 'Invalid token' });

    (req as AuthenticatedRequest).userId = user._id.toString();
    (req as AuthenticatedRequest).role = user.role;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

//try authentication, go to the next phase if it auth is successful or not
export const authenticateUser_No_Force = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    next();
  } else {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: UserType['role'] };
      const user = await User.findById(decoded.userId, { role: true });
      if (!user) return next();

      (req as AuthenticatedRequest).userId = user._id.toString();
      (req as AuthenticatedRequest).role = user.role;
      return next();
    } catch (error) {
      return next();
    }
  }
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

  if (serviceKey !== INTERNAL_SERVICE_KEY) {
    return res.status(403).json({
      message: 'Invalid service key',
      code: 'INVALID_SERVICE_KEY',
    });
  }

  // Set flag to bypass rate limiting
  (req as any).isInternalService = true;
  next();
};
