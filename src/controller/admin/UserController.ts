import { Request, Response } from 'express';
import Admin_UserService from '@/services/admin/UserService';

// Get all users with pagination and search
const getAllUsers = async (req: Request, res: Response) => {
  try {
    const { page, limit, search } = req.query;
    const { data, code, message } = await Admin_UserService.getAllUsersWithPaginationAndSearch({
      page: Number(page) || 1,
      search: `${search}`,
      ...(limit && { limit: ~~limit }),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getAllUsers:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Get user and all their basic info
const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { orderPage, orderLimit, reviewPage, reviewLimit } = req.query;
    const { data, code, message } = await Admin_UserService.getUserAndAllTheirBasicInfo({
      userId: id,
      orderPage: Number(orderPage) || 1,
      reviewPage: Number(reviewPage) || 1,
      ...(orderLimit && { orderLimit: Number(orderLimit) }),
      ...(reviewLimit && { reviewLimit: Number(reviewLimit) }),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getUserById:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Update user role
const updateUserRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const { message, code } = await Admin_UserService.updateUserRole({ userId: id, role });
    return res.status(code).json({ message });
  } catch (error) {
    console.error('Error in updateUserRole:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Update user suspension status
const updateUserSuspension = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { suspend } = req.body;
    const { message, code } = await Admin_UserService.suspendedStatus({ userId: id, suspend });
    return res.status(code).json({ message });
  } catch (error) {
    console.error('Error in updateUserSuspension:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Delete user
const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message, code } = await Admin_UserService.deleteUser(id);
    return res.status(code).json({ message });
  } catch (error) {
    console.error('Error in deleteUser:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const getUsersByRole = async (req: Request, res: Response) => {
  try {
    const { role, page } = req.query;
    const { data, code, message } = await Admin_UserService.getUsersByRole({
      role: role as string,
      ...(page && { page: Number(page) }),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getUsersByRole:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const Admin_UserController = {
  getAllUsers,
  getUserById,
  updateUserSuspension,
  updateUserRole,
  deleteUser,
  getUsersByRole,
};
export default Admin_UserController;
