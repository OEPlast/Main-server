import { UserType } from '@/models/User';
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/types';
import jwt from 'jsonwebtoken';
import User from '@/models/User';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('Set JWT secret');
}

export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
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
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
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
