import AuthService from '@/services/authService';
import { Request, Response } from 'express';

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
    const { email, password, firstName, lastName } = req.body;
    const { data, message, code } = await AuthService.signup({ email, password, firstName, lastName });
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
    const { message, code: statusCode } = await AuthService.resetPasswordWithCode({ email, code, newPassword });
    return res.status(statusCode).json({ message });
  } catch (error) {
    console.error('Error in resetPasswordWithCode:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Change password using current password
const updateUserPassword = async (req: Request, res: Response) => {
  try {
    const { user, currentPassword, newPassword } = req.body;
    const { message, code } = await AuthService.changePassword({ userId: user, currentPassword, newPassword });
    return res.status(code).json({ message });
  } catch (error) {
    console.error('Error in changePassword:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const verifyAccountOtp = async (req: Request, res: Response) => {
  try {
    const { user, code } = req.body;
    const { message, code: statusCode } = await AuthService.verifyAccountOtp({ userId: user, code });
    return res.status(statusCode).json({ message });
  } catch (error) {
    console.error('Error in verifyAccountOtp:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};
const resendVerifyAccountOtp = async (req: Request, res: Response) => {
  try {
    const { user } = req.body;
    const { message, code: statusCode } = await AuthService.resendAccountOtp({ userId: user });
    return res.status(statusCode).json({ message });
  } catch (error) {
    console.error('Error in verifyAccountOtp:', error);
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
};
export default AuthController;
