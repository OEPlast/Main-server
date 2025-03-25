import { Request, Response } from 'express';
import User from '../../models/User';

// Update user role
const updateUserRole = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user.role = role;
    await user.save();
    res.status(200).json({ message: 'User role updated successfully', data: user.role });
  } catch (error) {
    console.error('Error in updateUserRole:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export { updateUserRole };
