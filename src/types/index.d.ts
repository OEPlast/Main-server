import { UserType } from '@/models/User';
import { Request } from 'express';

declare module 'express' {
  export interface Request {
    userId?: string;
    role?: UserType['role'];
  }
}

// Type for authenticated requests where userId is guaranteed to exist
export interface AuthenticatedRequest extends Request {
  userId: string;
  role: UserType['role'];
}

// Type guard to check if request is authenticated
export function isAuthenticatedRequest(req: Request): req is AuthenticatedRequest {
  return !!req.userId && !!req.role;
}

export interface CustomResponseType<T = undefined> {
  message: string;
  data: T | null;
  code: number;
}

export type CustomResponsePromise<T = undefined> = Promise<CustomResponseType<T>>;
