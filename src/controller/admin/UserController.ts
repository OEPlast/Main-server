import { Request, Response } from 'express';
import Admin_UserService from '@/services/admin/UserService';
import { UserType } from '@/models/User';

// Get all users with pagination and search
const getAllUsers = async (req: Request, res: Response) => {
  try {
    const { role, page, limit, search, sort } = req.query;
    const sortDir = sort === '1' ? 1 : -1; // default -1 (desc)
    const { data, code, message } = await Admin_UserService.getAllUsersWithPaginationAndSearch({
      page: Number(page) || 1,
      role: role as unknown as UserType['role'] | undefined,
      search: search ? search.toString() : undefined,
      sort: sortDir,
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

// Get all staff (employees and owners) with pagination
const getStaff = async (req: Request, res: Response) => {
  try {
    const { page, limit, search, sort, role } = req.query;
    const sortDir = sort === '1' ? 1 : -1;
    const { data, code, message } = await Admin_UserService.getStaff({
      page: Number(page) || 1,
      search: search ? search.toString() : undefined,
      role: role as 'employee' | 'owner' | undefined,
      sort: sortDir,
      ...(limit && { limit: Number(limit) }),
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in getStaff:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// Search users for autocomplete/selector
const searchUsers = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    const { data, code, message } = await Admin_UserService.searchUsers(q as string);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in searchUsers:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// List courier-eligible staff: owners or staff with DELIVERY permission
const listCouriers = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const { data, code, message } = await Admin_UserService.listCouriers({
      search: search ? String(search) : undefined,
    });
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in listCouriers:', error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

const Admin_UserController = {
  getAllUsers,
  getUserById,
  updateUserSuspension,
  updateUserRole,
  deleteUser,
  getStaff,
  searchUsers,
  listCouriers,
};
export default Admin_UserController;
