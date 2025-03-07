import bcrypt from 'bcrypt';
import User, { UserType } from '../models/User';
import { CustomResponseType } from '../types';
import tokenizer from '@/lib/tokenizer';

/**
 * Creates a new user.
 * @param userData - The data of the user to create.
 * @returns A promise that resolves to a custom response containing the created user.
 */
const signup = async (userData: {
  email: string;
  password: string;
}): Promise<CustomResponseType<UserType & { token: string }>> => {
  try {
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      return {
        message: 'User already exists',
        data: null,
        code: 400,
      };
    }
    const hashedPassword = await bcrypt.hash(userData.password!, 19);
    const newUser = new User({ ...userData, password: hashedPassword });
    await newUser.save();
    const token = tokenizer.SignData({ userId: newUser._id });

    return {
      message: 'User created successfully',
      data: { ...newUser, token },
      code: 201,
    };
  } catch (error) {
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Logs in a user.
 * @param email - The email of the user.
 * @param password - The password of the user.
 * @returns A promise that resolves to a custom response containing a token.
 */
const login = async (email: string, password: string): Promise<CustomResponseType<UserType & { token: string }>> => {
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return {
        message: 'User not found',
        data: null,
        code: 404,
      };
    }
    if (!user.password) {
      return {
        message: 'Password not set',
        data: null,
        code: 400,
      };
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return {
        message: 'Invalid credentials',
        data: null,
        code: 401,
      };
    }
    const token = tokenizer.SignData({ userId: user._id });
    return {
      message: 'Login successful',
      data: { ...user, token },
      code: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Signs out a user.
 * @returns A promise that resolves to a custom response.
 */
const signout = async (): Promise<CustomResponseType<null>> => {
  // Implement signout logic if needed (e.g., token blacklist)
  return {
    message: 'Signout successful',
    data: null,
    code: 200,
  };
};

/**
 * Resets a user's password.
 * @param email - The email of the user.
 * @param newPassword - The new password of the user.
 * @returns A promise that resolves to a custom response.
 */
const resetPassword = async (email: string, newPassword: string): Promise<CustomResponseType<null>> => {
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return {
        message: 'User not found',
        data: null,
        code: 404,
      };
    }
    user.password = await bcrypt.hash(newPassword, 19);
    await user.save();
    return {
      message: 'Password reset successful',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Changes a user's password.
 * @param userId - The ID of the user.
 * @param currentPassword - The current password of the user.
 * @param newPassword - The new password of the user.
 * @returns A promise that resolves to a custom response.
 */
const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<CustomResponseType<null>> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return {
        message: 'User not found',
        data: null,
        code: 404,
      };
    }
    if (!user.password) {
      return {
        message: 'Password not set',
        data: null,
        code: 400,
      };
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return {
        message: 'Current password is incorrect',
        data: null,
        code: 400,
      };
    }
    user.password = await bcrypt.hash(newPassword, 19);
    await user.save();
    return {
      message: 'Password changed successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

const AuthService = {
  signup,
  login,
  signout,
  resetPassword,
  changePassword,
};

export default AuthService;
