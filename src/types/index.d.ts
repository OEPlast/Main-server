declare module 'express' {
  export interface Request {
    userId?: string;
    role?: string;
  }
}

export interface CustomResponseType<T> {
  message: string;
  data: T | null;
  code: number;
}
