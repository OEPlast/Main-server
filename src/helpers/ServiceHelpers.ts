import { CustomResponseType } from '@/types';

/**
 * Creates a consistent error response
 */
export const ErrorResponse = <T>(message: string, code: number = 500): CustomResponseType<T> => ({
  message,
  data: null,
  code,
});
