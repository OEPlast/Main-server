import AuthService, { type RequestContext } from '@/services/authService';
import { isAuthenticatedRequest } from '@/types';
import { Request, Response } from 'express';

/**
 * Captures who made a request, for the password-change security notification.
 * Best-effort only — a proxy that strips these just means a slightly thinner email.
 */
const requestContext = (req: Request): RequestContext => ({
  ipAddress: (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip,
  device: req.get('user-agent') ?? undefined,
});

// User login
const userLogin = async (req: Request, res: Response) => {
  try {
    // Logic for user login
    const { email, password } = req.body;
    const { data, code, message } = await AuthService.login({ email, password });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in userLogin:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// User logout
const userLogout = async (req: Request, res: Response) => {
  try {
    // Logic for user logout
    return res.status(200).json({ message: 'User logged out successfully' });
  } catch (error) {
    console.error('Error in userLogout:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// User registration
const userRegister = async (req: Request, res: Response) => {
  try {
    // Logic for user registration
    const { email, password, firstName, lastName, country } = req.body;
    const { data, message, code } = await AuthService.signup({ email, password, firstName, lastName, country });
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in userRegister:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Request reset password code
const requestResetPasswordCode = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const { message, code } = await AuthService.requestResetCode(email);
    return res.status(code).json({ message });
  } catch (error) {
    console.error('Error in requestResetPasswordCode:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Reset password using code
const resetUserPasswordByCode = async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;
    const { message, code: statusCode } = await AuthService.resetPasswordWithCode({
      email,
      code,
      newPassword,
      context: requestContext(req),
    });
    return res.status(statusCode).json({ message });
  } catch (error) {
    console.error('Error in resetPasswordWithCode:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Change password using current password
const updateUserPassword = async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    const { currentPassword, newPassword } = req.body;
    const { message, code } = await AuthService.changePassword({
      userId: req.userId,
      currentPassword,
      newPassword,
      context: requestContext(req),
    });
    return res.status(code).json({ message });
  } catch (error) {
    console.error('Error in changePassword:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const verifyAccountOtp = async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    const { code } = req.body;
    const userId = req.userId;
    const { message, code: statusCode } = await AuthService.verifyAccountOtp({ userId, code });
    return res.status(statusCode).json({ message });
  } catch (error) {
    console.error('Error in verifyAccountOtp:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};
const resendVerifyAccountOtp = async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    const { message, code: statusCode } = await AuthService.resendAccountOtp({ userId: req.userId });
    return res.status(statusCode).json({ message });
  } catch (error) {
    console.error('Error in verifyAccountOtp:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const providerLogin = async (req: Request, res: Response) => {
  try {
    const { provider, providerAccountId } = req.body;
    const { data, code, message } = await AuthService.loginWithProvider({ provider, providerAccountId });
    return res.status(code).json({ message, data });
  } catch (error) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Set password for provider-based accounts
const setPassword = async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    const { newPassword } = req.body;
    const { message, code } = await AuthService.setPassword({ userId: req.userId, newPassword });
    return res.status(code).json({ message });
  } catch (error) {
    console.error('Error in setPassword:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Check if user has password set
const userPasswordAndProviderStatus = async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    const { message, code, data } = await AuthService.getUserPasswordAndProviderStatus({ userId: req.userId });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in userPasswordAndProviderStatus:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const AuthController = {
  userLogin,
  userLogout,
  userRegister,
  updateUserPassword,
  resetUserPasswordByCode,
  requestResetPasswordCode,
  verifyAccountOtp,
  resendVerifyAccountOtp,
  providerLogin,
  setPassword,
  userPasswordAndProviderStatus,
};
export default AuthController;
