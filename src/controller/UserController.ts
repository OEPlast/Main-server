import { Request, Response } from 'express';
import { isAuthenticatedRequest } from '@/types/index';
import UserService from '../services/userService';

// Get user profile
const getProfile = async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.userId;
    const result = await UserService.getUserProfile(userId);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getProfile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Update user profile
const updateProfile = async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.userId;
    const updates = req.body;
    const { code, data, message } = await UserService.updateUserProfile(userId, updates);
    return res.status(code).json({ message, data });
  } catch (error) {
    console.error('Error in updateProfile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Change password
const changePassword = async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;
    const result = await UserService.changePassword(userId, currentPassword, newPassword);
    return res.status(result.code).json({ message: result.message });
  } catch (error) {
    console.error('Error in changePassword:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Add address
const addAddress = async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.userId;
    const addressData = req.body;
    const result = await UserService.addAddress(userId, addressData);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in addAddress:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Update address
const updateAddress = async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.userId;
    const { addressId } = req.params;
    const updates = req.body;
    const result = await UserService.updateAddress(userId, addressId, updates);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in updateAddress:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete address
const deleteAddress = async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.userId;
    const { addressId } = req.params;
    const result = await UserService.deleteAddress(userId, addressId);
    return res.status(result.code).json({ message: result.message });
  } catch (error) {
    console.error('Error in deleteAddress:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all addresses
const getAddresses = async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.userId;
    const result = await UserService.getUserAddresses(userId);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getAddresses:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get user permissions from all roles
const getUserPermissions = async (req: Request, res: Response) => {
  try {
    if (!isAuthenticatedRequest(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.userId;
    const result = await UserService.getUserPermissions(userId);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getUserPermissions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getProfile,
  updateProfile,
  changePassword,
  addAddress,
  updateAddress,
  deleteAddress,
  getAddresses,
  getUserPermissions,
};
