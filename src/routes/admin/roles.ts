import express from 'express';
import RoleController from '../../controller/admin/RoleController';
import RoleValidator from '../../validators/admin/RoleValidator';
import { authenticateUser, isAdmin, requirePermission } from '../../middleware/auth';

const router = express.Router();

// All role routes require authentication and admin privileges
router.use(authenticateUser, isAdmin);

// Role CRUD operations
router.post('/', requirePermission('roles', 'create'), RoleValidator.createRoleValidator, RoleController.createRole);
router.get('/', requirePermission('roles', 'read'), RoleController.getAllRoles);
router.get('/:roleId', requirePermission('roles', 'read'), RoleValidator.roleIdValidator, RoleController.getRoleById);
router.put(
  '/:roleId',
  requirePermission('roles', 'update'),
  RoleValidator.updateRoleValidator,
  RoleController.updateRole
);
router.delete(
  '/:roleId',
  requirePermission('roles', 'delete'),
  RoleValidator.roleIdValidator,
  RoleController.deleteRole
);

// Permission management
router.post(
  '/:roleId/permissions',
  requirePermission('roles', 'update'),
  RoleValidator.addPermissionValidator,
  RoleController.addPermission
);
router.delete(
  '/:roleId/permissions/:permission',
  requirePermission('roles', 'update'),
  RoleValidator.removePermissionValidator,
  RoleController.removePermission
);
router.get(
  '/:roleId/permissions',
  requirePermission('roles', 'read'),
  RoleValidator.roleIdValidator,
  RoleController.getRolePermissions
);

// User role assignment
router.post(
  '/users/:userId/roles/:roleId',
  requirePermission('roles', 'update'),
  RoleValidator.assignRoleValidator,
  RoleController.assignRoleToUser
);
router.delete(
  '/users/:userId/roles/:roleId',
  requirePermission('roles', 'update'),
  RoleValidator.assignRoleValidator,
  RoleController.removeRoleFromUser
);
router.get(
  '/users/:userId/roles',
  requirePermission('roles', 'read'),
  RoleValidator.userIdValidator,
  RoleController.getUserRoles
);

// Permission checking
router.get(
  '/users/:userId/permissions',
  requirePermission('roles', 'read'),
  RoleValidator.userIdValidator,
  RoleController.getUserPermissions
);
router.post(
  '/users/:userId/permissions/check',
  requirePermission('roles', 'read'),
  RoleValidator.checkPermissionValidator,
  RoleController.checkUserPermission
);

export default router;
