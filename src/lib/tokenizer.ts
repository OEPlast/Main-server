import jwt, { SignOptions } from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

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
  VerifyData,
};
