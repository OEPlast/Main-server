import { UserType } from '@/models/User';

declare module 'express' {
  export interface Request {
    userId?: string;
    role?: UserType['role'];
  }
}

export interface CustomResponseType<T> {
  message: string;
  data: T | null;
  code: number;
}
