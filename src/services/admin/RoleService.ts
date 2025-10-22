import { PermissionAction, RolePermission, PermissionResource } from '@/types/permissions';
import Role, { IRole } from '../../models/Role';
import User from '../../models/User';
import { CustomResponseType } from '@/types';
import mongoose from 'mongoose';

/**
 * Create a new role
 */
const createRole = async (roleData: Partial<IRole>): Promise<CustomResponseType<IRole>> => {
  try {
    const role = await Role.create(roleData);

    return {
      message: 'Role created successfully',
      data: role,
      code: 201,
    };
  } catch (error) {
    type MongoError = { code?: number; message?: string };
    if ((error as MongoError).code === 11000) {
      return {
        message: 'Role name already exist',
        data: null,
        code: 404,
      };
    }
    console.error('Error creating role:', error);

    return {
      message: 'Failed to create role',
      data: null,
      code: 500,
    };
  }
};

/**
 * Get all roles with pagination
 */
const getAllRoles = async (
  page: number = 1,
  limit: number = 10,
  isActive?: boolean
): Promise<CustomResponseType<IRole[]>> => {
  try {
    const skip = (page - 1) * limit;
    const filter: { isActive?: boolean } = {};
    if (typeof isActive === 'boolean') {
      filter.isActive = isActive;
    }

    const roles = await Role.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 });

    return {
      message: 'Roles retrieved successfully',
      data: roles,
      code: 200,
    };
  } catch (error) {
    console.error('Error getting roles:', error);
    return {
      message: 'Failed to get roles',
      data: null,
      code: 500,
    };
  }
};

/**
 * Get a role by ID
 */
const getRoleById = async (roleId: string): Promise<CustomResponseType<IRole>> => {
  try {
    const role = await Role.findById(roleId).lean();

    if (!role) {
      return {
        message: 'Role not found',
        data: null,
        code: 404,
      };
    }

    const usersUsingRole = await User.find({ roles: roleId }).select('_id firstName lastName email image').lean();

    const roleWithUsers = {
      ...role,
      users: usersUsingRole,
      users_count: usersUsingRole.length,
    };

    return {
      message: 'Role retrieved successfully',
      data: roleWithUsers as unknown as IRole,
      code: 200,
    };
  } catch (error) {
    console.error('Error getting role:', error);
    return {
      message: 'Failed to get role',
      data: null,
      code: 500,
    };
  }
};

/**
 * Update a role
 */
const updateRole = async (roleId: string, updateData: Partial<IRole>): Promise<CustomResponseType<IRole>> => {
  try {
    const role = await Role.findByIdAndUpdate(roleId, updateData, { new: true });

    if (!role) {
      return {
        message: 'Role not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Role updated successfully',
      data: role,
      code: 200,
    };
  } catch (error) {
    type MongoError = { code?: number; message?: string };
    if ((error as MongoError).code === 11000) {
      return {
        message: 'Role name already exist',
        data: null,
        code: 404,
      };
    }
    console.error('Error updating role:', error);
    return {
      message: 'Failed to update role',
      data: null,
      code: 500,
    };
  }
};

/**
 * Delete a role
 */
const deleteRole = async (roleId: string): Promise<CustomResponseType<null>> => {
  try {
    const existing = await Role.findById(roleId).select('_id');
    if (!existing) {
      return { message: 'Role not found', data: null, code: 404 };
    }
    await User.updateMany({ roles: roleId }, { $pull: { roles: roleId } });

    // Delete the role document
    await Role.deleteOne({ _id: roleId });

    return {
      message: 'Role deleted successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error deleting role:', error);
    return {
      message: 'Failed to delete role',
      data: null,
      code: 500,
    };
  }
};

// Utilities
const mergePermissions = (perms: RolePermission[]): RolePermission[] => {
  const map = new Map<PermissionResource, Set<PermissionAction>>();
  for (const p of perms) {
    const key = p.resource;
    if (!map.has(key)) map.set(key, new Set<PermissionAction>());
    const set = map.get(key)!;
    p.actions.forEach((a) => set.add(a));
  }
  return Array.from(map.entries()).map(([resource, actionsSet]) => ({
    resource,
    actions: Array.from(actionsSet),
  }));
};

// Assign role to user
const assignRoleToUser = async (userId: string, roleId: string) => {
  try {
    const role = await Role.findById(roleId);
    if (!role || !role.isActive) {
      return { message: 'Role not found or inactive', data: null, code: 404 };
    }

    const user = await User.findById(userId).select('roles');
    if (!user) return { message: 'User not found', data: null, code: 404 };

    await User.updateOne({ _id: userId }, { $addToSet: { roles: role._id } });

    return { message: 'Role assigned to user', data: null, code: 200 };
  } catch (error) {
    console.error('Error assigning role to user:', error);
    return { message: 'Failed to assign role to user', data: null, code: 500 };
  }
};

// Remove role from user
const removeRoleFromUser = async (userId: string, roleId: string) => {
  try {
    const user = await User.findById(userId).select('roles');
    if (!user) return { message: 'User not found', data: null, code: 404 };

    await User.updateOne({ _id: userId }, { $pull: { roles: roleId } });

    return { message: 'Role removed from user', data: null, code: 200 };
  } catch (error) {
    console.error('Error removing role from user:', error);
    return { message: 'Failed to remove role from user', data: null, code: 500 };
  }
};

// Get user roles
const getUserRoles = async (userId: string) => {
  try {
    const user = await User.findById(userId).select('role roles email firstName lastName').populate({
      path: 'roles',
      select: 'name description permissions isActive',
    });
    if (!user) return { message: 'User not found', data: [], code: 404 };
    const roles =
      (user.roles as unknown as Array<{
        name?: string;
        description?: string;
        permissions?: RolePermission[];
        isActive?: boolean;
      }>) || [];
    return { message: 'User roles retrieved', data: {roles, role: user.role, email: user.email, firstName: user.firstName, lastName: user.lastName}, code: 200 };
  } catch (error) {
    console.error('Error getting user roles:', error);
    return { message: 'Failed to get user roles', data: [], code: 500 };
  }
};

// Aggregate user permissions across active roles
const getUserPermissions = async (userId: string) => {
  try {
    const user = await User.findById(userId)
      .select('roles')
      .populate({ path: 'roles', select: 'permissions isActive' });
    if (!user) return { message: 'User not found', data: [], code: 404 };
    const roles = (user as unknown as { roles: { isActive: boolean; permissions: RolePermission[] }[] }).roles || [];
    const activePerms = roles.filter((r) => r.isActive).flatMap((r) => r.permissions || []);
    const merged = mergePermissions(activePerms);
    return { message: 'User permissions retrieved', data: merged, code: 200 };
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return { message: 'Failed to get user permissions', data: [], code: 500 };
  }
};

// Check if a user has a permission
const checkUserPermission = async (userId: string, resource: PermissionResource, action: PermissionAction) => {
  try {
    const permsRes = await getUserPermissions(userId);
    if (!Array.isArray(permsRes.data)) return { message: permsRes.message, data: false, code: permsRes.code };
    const allowed = permsRes.data.some((p: RolePermission) => {
      if (p.resource !== resource) return false;
      return (
        p.actions.includes(action) ||
        p.actions.includes(PermissionAction.ALL) ||
        p.actions.includes(PermissionAction.WILDCARD)
      );
    });
    return { message: 'Permission check complete', data: allowed, code: 200 };
  } catch (error) {
    console.error('Error checking user permission:', error);
    return { message: 'Failed to check user permission', data: false, code: 500 };
  }
};

// Check a single role's permission
const checkPermission = async (roleId: string, resource: PermissionResource, action: PermissionAction) => {
  try {
    const role = await Role.findById(roleId).select('permissions');
    if (!role) return { message: 'Role not found', data: false, code: 404 };

    // Find permission block for the single resource in question
    const permBlock = role.permissions?.find((p) => p.resource === resource);
    if (!permBlock) return { message: 'Role permission check complete', data: false, code: 200 };

    const allowed =
      permBlock.actions.includes(action) ||
      permBlock.actions.includes(PermissionAction.ALL) ||
      permBlock.actions.includes(PermissionAction.WILDCARD);

    return { message: 'Role permission check complete', data: allowed, code: 200 };
  } catch (error) {
    console.error('Error checking role permission:', error);
    return { message: 'Failed to check role permission', data: false, code: 500 };
  }
};

const getRolePermissions = async (roleId: string) => {
  try {
    const role = await Role.findById(roleId).select('permissions');
    if (!role) return { message: 'Role not found', data: [], code: 404 };
    return { message: 'Role permissions retrieved', data: role.permissions || [], code: 200 };
  } catch (error) {
    console.error('Error getting role permissions:', error);
    return { message: 'Failed to get role permissions', data: [], code: 500 };
  }
};

type UserSummary = { _id: mongoose.Types.ObjectId; firstName: string; lastName: string; email: string; image?: string };
const getUsersByRole = async (
  roleId: string,
  page: number = 1,
  limit: number = 50
): Promise<CustomResponseType<UserSummary[]>> => {
  try {
    const skip = (page - 1) * limit;

    // Ensure role exists
    const role = await Role.findById(roleId).select('_id');
    if (!role) return { message: 'Role not found', data: [], code: 404 };

    const users = await User.find({ roles: roleId })
      .select('_id name image email firstName lastName')
      .skip(skip)
      .limit(limit);

    return { message: 'Users retrieved', data: users, code: 200 };
  } catch (error) {
    console.error('Error getting users by role:', error);
    return { message: 'Failed to get users by role', data: [], code: 500 };
  }
};

// Add new user as employee with roles
const addUserAsEmployee = async (email: string, roleIds: string[]) => {
  try {
    const user = await User.findOne({ email }).select('role roles email firstName lastName');
    if (!user) {
      return { message: 'User not found', data: null, code: 404 };
    }

    // Check if user is already an employee or owner
    if (user.role !== 'user') {
      return { message: 'User is already an employee or owner', data: null, code: 400 };
    }

    // Validate all role IDs exist and are active
    const roles = await Role.find({ _id: { $in: roleIds }, isActive: true });
    if (roles.length !== roleIds.length) {
      return { message: 'One or more roles not found or inactive', data: null, code: 404 };
    }

    // Update user to employee and assign roles
    user.role = 'employee';
    user.roles = roleIds.map((id) => new mongoose.Types.ObjectId(id));
    await user.save();

    return {
      message: 'User promoted to employee successfully',
      data: user,
      code: 200,
    };
  } catch (error) {
    console.error('Error adding user as employee:', error);
    return { message: 'Failed to add user as employee', data: null, code: 500 };
  }
};

// Revoke admin access (demote employee to user)
const revokeAdminAccess = async (userId: string) => {
  try {
    const user = await User.findById(userId).select('role roles email firstName lastName');
    if (!user) {
      return { message: 'User not found', data: null, code: 404 };
    }

    // Cannot demote owner
    if (user.role === 'owner') {
      return { message: 'Cannot revoke admin access from owner', data: null, code: 403 };
    }

    // Only demote if currently employee
    if (user.role !== 'employee') {
      return { message: 'User is not an employee', data: null, code: 400 };
    }

    // Demote to user and clear all roles
    user.role = 'user';
    user.roles = [];
    await user.save();

    return {
      message: 'Admin access revoked successfully',
      data: user,
      code: 200,
    };
  } catch (error) {
    console.error('Error revoking admin access:', error);
    return { message: 'Failed to revoke admin access', data: null, code: 500 };
  }
};

// Edit user roles (replace existing roles with new ones)
const modifyUserPermissions = async (userId: string, roleIds: string[]) => {
  try {
    const user = await User.findById(userId).select('role roles email firstName lastName');
    if (!user) {
      return { message: 'User not found', data: null, code: 404 };
    }

    // Can only edit permission for employees
    if (user.role !== 'employee') {
      return { message: 'Can only edit permission for employees', data: null, code: 400 };
    }

    // Validate all role IDs exist and are active
    const permissions = await Role.find({ _id: { $in: roleIds }, isActive: true });
    if (permissions.length !== roleIds.length) {
      return { message: 'One or more permission not found or inactive', data: null, code: 404 };
    }

    // Replace permission
    user.roles = roleIds.map((id) => new mongoose.Types.ObjectId(id));
    await user.save();

    return {
      message: 'User permission updated successfully',
      data: user,
      code: 200,
    };
  } catch (error) {
    console.error('Error editing user permission:', error);
    return { message: 'Failed to edit user permission', data: null, code: 500 };
  }
};

const RoleService = {
  createRole,
  getAllRoles,
  getRoleById,
  updateRole,
  deleteRole,
  assignRoleToUser,
  removeRoleFromUser,
  getUserRoles,
  getUserPermissions,
  checkUserPermission,
  checkPermission,
  getRolePermissions,
  getUsersByRole,
  addUserAsEmployee,
  revokeAdminAccess,
   modifyUserPermissions,
};

export default RoleService;
