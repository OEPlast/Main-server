import { UserType } from '@/models/User';

declare module 'express' {
  export interface Request {
    userId?: string;
    role?: UserType['role'];
  }
}

export interface CustomResponseType<T = undefined> {
  message: string;
  data: T | null;
  code: number;
}

export type CustomResponsePromise<T = undefined> = Promise<CustomResponseType<T>>;
