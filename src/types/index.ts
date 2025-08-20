import { UserType } from '@/models/User';
import { Request } from 'express';

// Type for authenticated requests where userId is guaranteed to exist
export interface AuthenticatedRequest extends Request {
  userId: string;
  role: UserType['role'];
}

// Type guard to check if request is authenticated
export function isAuthenticatedRequest(req: Request): req is AuthenticatedRequest {
  return !!(req as AuthenticatedRequest).userId && !!(req as AuthenticatedRequest).role;
}

// Standard response interface for API responses
export interface CustomResponseType<T = undefined> {
  message: string;
  data: T | null;
  code: number;
}

// Promise wrapper for custom response type
export type CustomResponsePromise<T = undefined> = Promise<CustomResponseType<T>>;

export type CustomResponseTypeWithMeta<T, M = undefined> = Promise<{
  message: string;
  data: T | null;
  code: number;
  meta?: M;
}>;
