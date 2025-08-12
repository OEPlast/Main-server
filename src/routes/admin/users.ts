import Admin_UserController from '@/controller/admin/UserController';
import Admin_UserValidator from '@/validators/admin/UserValidator';
import { isAdmin, isAuthenticated, requirePermission } from '@/middleware/auth';
import express from 'express';
const router = express.Router();

router.get(
  '/',
  isAuthenticated,
  isAdmin,
  requirePermission('users', 'read'),
  Admin_UserValidator.getAllUsersValidator,
  Admin_UserController.getAllUsers
);
router.get(
  '/byRole',
  isAuthenticated,
  isAdmin,
  requirePermission('users', 'read'),
  Admin_UserValidator.usersByRole,
  Admin_UserController.getUsersByRole
);
router.get(
  '/:id',
  isAuthenticated,
  isAdmin,
  requirePermission('users', 'read'),
  Admin_UserValidator.getUserByIdValidator,
  Admin_UserController.getUserById
);
router.put(
  '/:id/suspend',
  isAuthenticated,
  isAdmin,
  requirePermission('users', 'update'),
  Admin_UserValidator.updateUserSuspensionValidator,
  Admin_UserController.updateUserSuspension
);
router.delete(
  '/:id',
  isAuthenticated,
  isAdmin,
  requirePermission('users', 'delete'),
  Admin_UserValidator.deleteUserValidator,
  Admin_UserController.deleteUser
);
router.put(
  '/:id/role',
  isAuthenticated,
  isAdmin,
  requirePermission('users', 'update'),
  Admin_UserValidator.updateUserRoleValidator,
  Admin_UserController.updateUserRole
);

export default router;
