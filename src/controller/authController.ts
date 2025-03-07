import AuthService from '@/services/authService';
import { Request, Response } from 'express';

// User login
const userLogin = async (req: Request, res: Response) => {
  try {
    // Logic for user login
    return res.status(200).json({ message: 'User logged in successfully' });
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
    const { email, password } = req.body;
    const { data, code, message } = await AuthService.signup({ email, password });
    return res.status(code).json({ data, message });
  } catch (error) {
    console.error('Error in userRegister:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const AuthController = { userLogin, userLogout, userRegister };
export default AuthController;
