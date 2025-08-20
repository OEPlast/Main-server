// Helper to detect Mongo duplicate key error (code 11000)
export const isDuplicateKeyError = (err: unknown): err is { code: number; keyValue?: Record<string, unknown> } => {
  if (!err || typeof err !== 'object') return false;
  if (!('code' in err)) return false;
  const maybeCode = (err as { code?: unknown }).code;
  return typeof maybeCode === 'number' && maybeCode === 11000;
};

export const duplicateMessage = (err: { keyValue?: Record<string, unknown> }, tag: string): string => {
  if (err.keyValue) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    return `${tag} with ${field} '${value}' already exists`;
  }
  return `${tag} already exists`;
};
