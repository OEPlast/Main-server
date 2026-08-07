import passwordLib from '@/lib/password';
import User, { UserType } from '../models/User';
import { CustomResponsePromise, CustomResponseType } from '@/types';
import tokenizer from '@/lib/tokenizer';
import OTPService from './OTP';
import mongoose from 'mongoose';
import { eventPublisher } from '@/events';
import EmailProcessor from './processor/EmailProcessor';
import Account from '@/models/Account';
import { OTP_EXPIRY_MINUTES } from '@/models/OTP';
import { getBrand } from './email/brand';
import { shopUrl, supportUrl } from '@rawura/emails';

/**
 * Best-effort request context attached to security notifications, so a customer can tell a
 * change they made from one they did not.
 */
export type RequestContext = {
  ipAddress?: string;
  device?: string;
};

/**
 * Tells the account holder their password changed.
 *
 * Fired from every path that writes a new password. Silent password changes are the gap an
 * account takeover hides in, and the platform had no notification for them at all.
 */
const notifyPasswordChanged = async (
  user: { email: string; firstName?: string | null; lastName?: string | null },
  context: RequestContext = {}
): Promise<void> => {
  const brand = await getBrand();
  await EmailProcessor.send('password-changed', {
    email: user.email,
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    changedAt: new Date(),
    ipAddress: context.ipAddress,
    device: context.device,
    supportLink: supportUrl(brand),
  });
};

type TMiniUser = {
  _id: string;
  role: UserType['role'];
  name: UserType['name'];
  email: UserType['email'];
  image: UserType['image'];
  emailVerified?: UserType['emailVerified'];
  suspended: UserType['suspended'];
};
/**
 * Creates a new user.
 * @param userData - The data of the user to create.
 * @returns A promise that resolves to a custom response containing the created user and its token.
 */
const signup = async (userData: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  country: string;
}): CustomResponsePromise<{ newUser: UserType; token: string; otpCode: number }> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      return {
        message: 'User already exists',
        data: null,
        code: 400,
      };
    }

    const hashedPassword = await passwordLib.hashPassword(userData.password!);
    const newUser = new User({ ...userData, password: hashedPassword });
    await newUser.save({ session });

    // Create OTP for account verification
    const createOTP = await OTPService.createOtp({ user: newUser._id.toString(), type: 'create' });

    if (createOTP.code !== 200 || createOTP.data === null) {
      throw new Error('Failed to create OTP');
    }
    await session.commitTransaction();
    session.endSession();

    const token = tokenizer.SignData({ userId: newUser._id, role: newUser.role });

    eventPublisher.publishUserSignup({
      firstName: newUser.firstName!,
      otpCode: `${createOTP.data}`,
      email: newUser.email,
      expiresInMinutes: 10,
    });

    return {
      message: 'User created successfully. Please verify your account using the OTP sent to your email.',
      data: { newUser, token, otpCode: createOTP.data }, // Remove `otpCode` in production
      code: 201,
    };
  } catch (error) {
    console.log(error);
    await session.abortTransaction();
    session.endSession();

    return {
      message: error instanceof Error ? error.message : 'Registration failed',
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
const login = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<CustomResponseType<TMiniUser & { token: string }>> => {
  try {
    const user = await User.findOne(
      { email },
      {
        emailVerified: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
        image: true,
        suspended: true,
        role: true,
      }
    );
    if (!user) {
      return {
        message: 'User not found',
        data: null,
        code: 401,
      };
    }
    if (!user.password) {
      return {
        message: 'Password not set',
        data: null,
        code: 400,
      };
    }
    const isMatch = await passwordLib.comparePassword(user.password, password);
    if (!isMatch) {
      return {
        message: 'Incorrect password',
        data: null,
        code: 401,
      };
    }
    const token = tokenizer.SignData({ userId: user._id, role: user.role });
    return {
      message: 'Login successful',
      data: {
        emailVerified: user.emailVerified,
        token,
        name: user.firstName + ' ' + user.lastName,
        email: user.email,
        image: user.image,
        suspended: user.suspended,
        _id: user._id.toString(),
        role: user.role,
      },
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

const loginWithProvider = async (providerData: {
  provider: string;
  providerAccountId: string;
}): Promise<CustomResponseType<TMiniUser & { token: string }>> => {
  try {
    const account = await Account.findOne(providerData).populate({
      path: 'userId',
      select: '_id role suspended name image email',
    });
    console.log(providerData);

    if (!account) {
      return {
        code: 404,
        message: 'Account not found',
        data: null,
      };
    }

    const user = account.userId as unknown as TMiniUser;

    if (!user) {
      return {
        message: 'User not found',
        data: null,
        code: 404,
      };
    }

    // Generate JWT token
    const token = tokenizer.SignData({ userId: user._id, role: user.role });

    return {
      message: 'Login successful',
      data: {
        _id: user._id.toString(),
        role: user.role,
        name: user.name,
        email: user.email,
        image: user.image,
        suspended: user.suspended,
        token,
      },
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
    user.password = await passwordLib.hashPassword(newPassword);
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
const changePassword = async ({
  userId,
  currentPassword,
  newPassword,
  context,
}: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  context?: RequestContext;
}): Promise<CustomResponseType<null>> => {
  try {
    // `email` and `firstName` are needed for the change notification; the original
    // projection asked for the password alone.
    const user = await User.findById(userId, { password: true, email: true, firstName: true, lastName: true });
    if (!user) {
      return {
        message: 'User not found',
        data: null,
        code: 404,
      };
    }
    if (!user.password) {
      user.password = await passwordLib.hashPassword(newPassword);
      await user.save();
      await notifyPasswordChanged(user, context);
      return {
        message: 'Password changed successfully',
        data: null,
        code: 200,
      };
    }
    const isMatch = await passwordLib.comparePassword(user.password, currentPassword);
    if (!isMatch) {
      return {
        message: 'Current password is incorrect',
        data: null,
        code: 400,
      };
    }
    user.password = await passwordLib.hashPassword(newPassword);
    await user.save();
    await notifyPasswordChanged(user, context);
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

/**
 * Request reset password
 * @param email - the email of the user
 * @returns A promise that resolves to a custom response.
 */

const requestResetCode = async (email: string): Promise<CustomResponseType<null>> => {
  try {
    //check if the user exist
    const user = await User.findOne({ email });
    // if (!user) {
    //   return {
    //     message: 'User does not exist',
    //     data: null,
    //     code: 404,
    //   };
    // }
    //keep it basic to avoid email enumeration, this proved to be an exploitation and was causing some unnecessary errors for mails that intentionally was not even valid
    if (!user) {
      return {
        message: 'If the email is registered, a reset code has been sent.',
        data: null,
        code: 200,
      };
    }
    //then call the otp service
    const createOTP = await OTPService.createOtp({ user: user._id.toString(), type: 'reset password' });

    if (createOTP.data) {
      await EmailProcessor.send('forgot-password', {
        firstName: user.firstName ?? undefined,
        otpCode: createOTP.data.toString(),
        email: user.email,
        expiresInMinutes: OTP_EXPIRY_MINUTES,
      });
    }
    return {
      data: null,
      code: createOTP.code,
      message: 'If the email is registered, a reset code has been sent.',
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

const resetPasswordWithCode = async ({
  email,
  code,
  newPassword,
  context,
}: {
  email: string;
  code: number;
  newPassword: string;
  context?: RequestContext;
}) => {
  try {
    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return {
        message: 'User not found',
        data: null,
        code: 404,
      };
    }

    // Verify the OTP code
    const verifyOTP = await OTPService.verifyOtp({ user: user._id.toString(), code, type: 'reset password' });
    if (verifyOTP.code !== 200) {
      return {
        message: verifyOTP.message,
        data: null,
        code: verifyOTP.code,
      };
    }

    // Reset the password
    user.password = await passwordLib.hashPassword(newPassword);
    await user.save();

    await notifyPasswordChanged(user, context);

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

const verifyAccountOtp = async ({
  userId,
  code,
}: {
  userId: string;
  code: number;
}): Promise<CustomResponseType<null>> => {
  try {
    // Verify the OTP code
    const verifyOTP = await OTPService.verifyOtp({
      user: userId,
      code,
      type: 'create',
    });
    if (verifyOTP.code !== 200) {
      return {
        message: verifyOTP.message,
        data: null,
        code: verifyOTP.code,
      };
    }

    // Update the user's emailVerified field
    const user = await User.findById(userId);
    if (!user) {
      return {
        message: 'User not found',
        data: null,
        code: 404,
      };
    }

    user.emailVerified = new Date();
    await user.save();

    // Welcome email. The template has existed since the email system was written and nothing
    // ever called it — a verified account got no confirmation of any kind.
    const brand = await getBrand();
    await EmailProcessor.send('welcome', {
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      startShoppingLink: shopUrl(brand),
    });

    return {
      message: 'Account verified successfully',
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

const resendAccountOtp = async ({ userId }: { userId: string }): Promise<CustomResponseType<null>> => {
  try {
    //check if the user exist
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return {
        message: 'User does not exist',
        data: null,
        code: 401,
      };
    }
    // Resend the OTP code
    const createOTP = await OTPService.createOtp({
      user: userId,
      type: 'create',
    });

    if (createOTP.data) {
      await EmailProcessor.send('verification-email', {
        firstName: user.firstName ?? undefined,
        otpCode: `${createOTP.data}`,
        email: user.email,
        expiresInMinutes: OTP_EXPIRY_MINUTES,
      });
    }
    return {
      message: 'OTP sent successfully',
      data: null,
      code: createOTP.code,
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
 * Sets a password for provider-based accounts that don't have a password yet.
 * This is a one-time operation - once a password is set, users must use changePassword.
 * @param userId - The ID of the user.
 * @param newPassword - The new password to set.
 * @returns A promise that resolves to a custom response.
 */
const setPassword = async ({
  userId,
  newPassword,
}: {
  userId: string;
  newPassword: string;
}): Promise<CustomResponseType<null>> => {
  try {
    // Find the user
    const user = await User.findById(userId, { password: true });
    if (!user) {
      return {
        message: 'User not found',
        data: null,
        code: 404,
      };
    }

    // Check if password already exists
    if (user.password) {
      return {
        message: 'Password already set. Use change password to update your existing password.',
        data: null,
        code: 400,
      };
    }

    // Check if user has a provider account linked
    const hasProviderAccount = await Account.exists({ userId: user._id });
    if (!hasProviderAccount) {
      return {
        message: 'This feature is only available for accounts created with social providers (Google, GitHub, etc.).',
        data: null,
        code: 403,
      };
    }

    // Set the new password
    user.password = await passwordLib.hashPassword(newPassword);
    await user.save();

    return {
      message: 'Password set successfully. You can now login with your email and password.',
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
 * Checks if a user has a password set.
 * Useful for frontend to show "Set Password" vs "Change Password" UI.
 * @param userId - The ID of the user.
 * @returns A promise that resolves to a custom response with hasPassword boolean and provider info.
 */
const getUserPasswordAndProviderStatus = async ({
  userId,
}: {
  userId: string;
}): Promise<CustomResponseType<{ hasPassword: boolean; hasProviderAccount: boolean }>> => {
  try {
    // Find the user
    const [user, hasProviderAccount] = await Promise.all([
      User.findById(userId, { password: true }),
      Account.exists({ userId }),
    ]);
    if (!user) {
      return {
        message: 'User not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Password status retrieved successfully',
      data: {
        hasPassword: !!user.password,
        hasProviderAccount: !!hasProviderAccount,
      },
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
  requestResetCode,
  resetPasswordWithCode,
  verifyAccountOtp,
  resendAccountOtp,
  loginWithProvider,
  setPassword,
  getUserPasswordAndProviderStatus,
};

export default AuthService;
