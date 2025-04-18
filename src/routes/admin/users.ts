import Admin_UserController from '@/controller/admin/UserController';
import Admin_UserValidator from '@/validators/admin/UserValidator';
import { isAdmin, isAuthenticated } from '@/middleware/auth';
import express from 'express';
const router = express.Router();

router.get('/', isAuthenticated, isAdmin, Admin_UserValidator.getAllUsersValidator, Admin_UserController.getAllUsers);
router.get('/byRole', isAuthenticated, isAdmin, Admin_UserValidator.usersByRole, Admin_UserController.getUsersByRole);
router.get(
  '/:id',
  isAuthenticated,
  isAdmin,
  Admin_UserValidator.getUserByIdValidator,
  Admin_UserController.getUserById
);
router.put(
  '/:id/suspend',
  isAuthenticated,
  isAdmin,
  Admin_UserValidator.updateUserSuspensionValidator,
  Admin_UserController.updateUserSuspension
);
router.delete(
  '/:id',
  isAuthenticated,
  isAdmin,
  Admin_UserValidator.deleteUserValidator,
  Admin_UserController.deleteUser
);
router.put(
  '/:id/role',
  isAuthenticated,
  isAdmin,
  Admin_UserValidator.updateUserRoleValidator,
  Admin_UserController.updateUserRole
);

export default router;
