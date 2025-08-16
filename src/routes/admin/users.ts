import Admin_UserController from '@/controller/admin/UserController';
import Admin_UserValidator from '@/validators/admin/UserValidator';
import { isAdmin, authenticateUser, requirePermission } from '@/middleware/auth';
import express from 'express';
const router = express.Router();

router.get(
  '/',
  authenticateUser,
  isAdmin,
  requirePermission('users', 'read'),
  Admin_UserValidator.getAllUsersValidator,
  Admin_UserController.getAllUsers
);
router.get(
  '/byRole',
  authenticateUser,
  isAdmin,
  requirePermission('users', 'read'),
  Admin_UserValidator.usersByRole,
  Admin_UserController.getUsersByRole
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
