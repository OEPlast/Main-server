import Admin_UserController from '@/controller/admin/UserController';
import Admin_UserValidator from '@/validators/admin/UserValidator';
import { isAdmin, authenticateUser, requirePermission } from '@/middleware/auth';
import express from 'express';
import UserController from '@/controller/UserController';
const router = express.Router();

router.get(
  '/permissions',
  authenticateUser,
  // isAdmin,
  UserController.getUserPermissions
);

// Get all staff (employees and owners) with pagination
router.get(
  '/staff',
  authenticateUser,
  isAdmin,
  requirePermission('users', 'read'),
  Admin_UserValidator.getStaffValidator,
  Admin_UserController.getStaff
);

// Search users for autocomplete/selector
router.get(
  '/search',
  authenticateUser,
  isAdmin,
  requirePermission('users', 'read'),
  Admin_UserValidator.searchUsersValidator,
  Admin_UserController.searchUsers
);

router.get(
  '/all',
  authenticateUser,
  isAdmin,
  requirePermission('users', 'read'),
  Admin_UserValidator.getAllUsersValidator,
  Admin_UserController.getAllUsers
);

router.get(
  '/:id',
  authenticateUser,
  isAdmin,
  requirePermission('users', 'read'),
  Admin_UserValidator.getUserByIdValidator,
  Admin_UserController.getUserById
);

router.put(
  '/:id/suspend',
  authenticateUser,
  isAdmin,
  requirePermission('users', 'update'),
  Admin_UserValidator.updateUserSuspensionValidator,
  Admin_UserController.updateUserSuspension
);

//think of ways to make this more secure. Or hide the data somewhere. Deleting a user's data immediately and permanently seems somehow
router.delete(
  '/:id',
  authenticateUser,
  isAdmin,
  requirePermission('users', 'delete'),
  Admin_UserValidator.deleteUserValidator,
  Admin_UserController.deleteUser
);
router.put(
  '/:id/role',
  authenticateUser,
  isAdmin,
  requirePermission('users', 'update'),
  Admin_UserValidator.updateUserRoleValidator,
  Admin_UserController.updateUserRole
);

export default router;
