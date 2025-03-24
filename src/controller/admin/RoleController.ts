import { Request, Response } from 'express';
import RoleService from '../../services/admin/RoleService';

// Update user role
const updateUserRole = async (req: Request, res: Response) => {
  try {
    const { role, userId } = req.body;
    const { data, message, code } = await RoleService.updateUserRole({ userId, role });
    res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in updateUserRole:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default { updateUserRole };
