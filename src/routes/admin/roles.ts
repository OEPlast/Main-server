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
router.get(
  '/:roleId/users',
  requirePermission('roles', 'read'),
  RoleValidator.roleIdValidator,
  RoleController.getUsersByRole
);
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

router.get(
  '/:roleId/permissions',
  requirePermission('roles', 'read'),
  RoleValidator.roleIdValidator,
  RoleController.getRolePermissions
);


// New: Add user as employee
router.post(
  '/users/add-employee',
  requirePermission('roles', 'create'),
  RoleValidator.addUserAsEmployeeValidator,
  RoleController.addUserAsEmployee
);

// New: Revoke admin access (demote employee to user)
router.delete(
  '/users/:userId/revoke-access',
  requirePermission('roles', 'delete'),
  RoleValidator.userIdValidator,
  RoleController.revokeAdminAccess
);

// New: Edit user permissions (replace all permissions)
router.put(
  '/users/:userId/edit-permissions',
  requirePermission('roles', 'update'),
  RoleValidator.editUserPermissionsValidator,
  RoleController.modifyUserPermissions
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
