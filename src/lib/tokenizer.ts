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
const VerifyData = (data: string) => {
  try {
    return jwt.verify(data, JWT_SECRET);
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
