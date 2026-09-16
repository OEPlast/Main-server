import jwt, { SignOptions } from 'jsonwebtoken';

// No fallback: a guessable default secret would let anyone forge a token for any user.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('Set JWT secret');
}

/** The claims every session token carries. `tv` is the user's tokenVersion when it was issued. */
export type SessionClaims = { userId: string; role: string; tv?: number };

/**
 * Signs any object using JWT.
 *
 * @param data - The data object to be signed.
 * @param expires - The expiration time for the token. Defaults to '7d'.
 * @returns The signed JWT as a string.
 */
const SignData = (data: object, expires: SignOptions['expiresIn'] = '7d') => {
  try {
    return jwt.sign(data, JWT_SECRET, { expiresIn: expires });
  } catch (error) {
    if (error instanceof Error) {
      console.log(error.message);
    }
    throw new Error('Something went wrong when signing data');
  }
};

/**
 * Signs a login session for a user. Use this, not SignData, for anything that authenticates:
 * it stamps the user's tokenVersion so the session can be revoked.
 */
const SignSession = (user: {
  _id: { toString(): string };
  role?: string | null;
  tokenVersion?: number | null;
}) =>
  SignData({ userId: user._id.toString(), role: user.role ?? 'user', tv: user.tokenVersion ?? 0 });

/**
 * Verify any object using JWT.
 *
 * @param data - string to be decoded
 * @returns object data
 */
const VerifyData = <T>(data: string): T => {
  try {
    const decoded = jwt.verify(data, JWT_SECRET);
    if (typeof decoded === 'object' && decoded !== null) {
      return decoded as T;
    }
    throw new Error('Decoded token is not of the expected type');
  } catch (error) {
    if (error instanceof Error) {
      console.log(error.message);
    }
    throw new Error('Invalid token');
  }
};

export default {
  SignData,
  SignSession,
  VerifyData,
};
