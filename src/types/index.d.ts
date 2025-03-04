export interface CustomResponseType<T> {
  message: string;
  data: T | null;
  code: number;
}
