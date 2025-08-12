import Role, { IRole } from '../../models/Role';
import User from '../../models/User';
import { CustomResponseType } from '@/types';
import mongoose from 'mongoose';

/**
 * Create a new role
 */
const createRole = async (roleData: Partial<IRole>): Promise<CustomResponseType<IRole>> => {
  try {
    const role = new Role(roleData);
    await role.save();

    return {
      message: 'Role created successfully',
      data: role,
      code: 201,
    };
  } catch (error) {
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
    } else {
      filter.isActive = true; // Default to active roles only
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
    const role = await Role.findById(roleId);

    if (!role) {
      return {
        message: 'Role not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Role retrieved successfully',
      data: role,
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
    console.error('Error updating role:', error);
    return {
      message: 'Failed to update role',
      data: null,
      code: 500,
    };
  }
};

/**
 * Delete a role (soft delete)
 */
const deleteRole = async (roleId: string): Promise<CustomResponseType<null>> => {
  try {
    const role = await Role.findByIdAndUpdate(roleId, { isActive: false }, { new: true });

    if (!role) {
      return {
        message: 'Role not found',
        data: null,
        code: 404,
      };
    }

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

/**
 * Add permission to role
 */
const addPermissionToRole = async (roleId: string, permission: { resource: string; actions: string[] }) => {
  try {
    const role = await Role.findById(roleId);

    if (!role) {
      return {
        message: 'Role not found',
        data: null,
        code: 404,
      };
    }

    role.permissions.push(permission);
    await role.save();

    return {
      message: 'Permission added to role successfully',
      data: role,
      code: 200,
    };
  } catch (error) {
    console.error('Error adding permission to role:', error);
    return {
      message: 'Failed to add permission to role',
      data: null,
      code: 500,
    };
  }
};

/**
 * Remove permission from role
 */
const removePermissionFromRole = async (roleId: string, permission: string) => {
  try {
    const role = await Role.findById(roleId);

    if (!role) {
      return {
        message: 'Role not found',
        data: null,
        code: 404,
      };
    }

    const permissionIndex = role.permissions.findIndex((p) => p.resource === permission);
    if (permissionIndex > -1) {
      role.permissions.splice(permissionIndex, 1);
    }
    await role.save();

    return {
      message: 'Permission removed from role successfully',
      data: role,
      code: 200,
    };
  } catch (error) {
    console.error('Error removing permission from role:', error);
    return {
      message: 'Failed to remove permission from role',
      data: null,
      code: 500,
    };
  }
};

// Utilities
type Permission = { resource: string; actions: string[] };
const mergePermissions = (perms: Permission[]): Permission[] => {
  const map = new Map<string, Set<string>>();
  for (const p of perms) {
    const key = p.resource;
    if (!map.has(key)) map.set(key, new Set<string>());
    const set = map.get(key)!;
    p.actions.forEach((a) => set.add(a));
  }
  return Array.from(map.entries()).map(([resource, actionsSet]) => ({ resource, actions: Array.from(actionsSet) }));
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

    const hasRole = (user.roles as unknown as string[])?.some((r) => r.toString() === roleId);
    if (!hasRole) {
      (user.roles as unknown as string[]).push(roleId as unknown as string);
      await user.save();
    }

    const populated = await User.findById(userId).populate({ path: 'roles', select: 'name permissions isActive' });

    return { message: 'Role assigned to user', data: populated, code: 200 };
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

    const roleIdStr = roleId.toString();
    const updatedRoles = (user.roles as unknown as Array<mongoose.Types.ObjectId | string>).filter(
      (r) => r.toString() !== roleIdStr
    ) as Array<mongoose.Types.ObjectId | string>;
    // @ts-expect-error widen type for assignment
    user.roles = updatedRoles;
    await user.save();

    const populated = await User.findById(userId).populate({ path: 'roles', select: 'name permissions isActive' });

    return { message: 'Role removed from user', data: populated, code: 200 };
  } catch (error) {
    console.error('Error removing role from user:', error);
    return { message: 'Failed to remove role from user', data: null, code: 500 };
  }
};

// Get user roles
const getUserRoles = async (userId: string) => {
  try {
    const user = await User.findById(userId).populate({
      path: 'roles',
      select: 'name description permissions isActive',
    });
    if (!user) return { message: 'User not found', data: [], code: 404 };
    const roles =
      (user.roles as unknown as Array<{
        name?: string;
        description?: string;
        permissions?: Permission[];
        isActive?: boolean;
      }>) || [];
    return { message: 'User roles retrieved', data: roles, code: 200 };
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
    const roles = (user as unknown as { roles: { isActive: boolean; permissions: Permission[] }[] }).roles || [];
    const activePerms = roles.filter((r) => r.isActive).flatMap((r) => r.permissions || []);
    const merged = mergePermissions(activePerms);
    return { message: 'User permissions retrieved', data: merged, code: 200 };
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return { message: 'Failed to get user permissions', data: [], code: 500 };
  }
};

// Check if a user has a permission
const checkUserPermission = async (userId: string, resource: string, action: string) => {
  try {
    const permsRes = await getUserPermissions(userId);
    if (!Array.isArray(permsRes.data)) return { message: permsRes.message, data: false, code: permsRes.code };
    const allowed = permsRes.data.some((p: Permission) => {
      if (p.resource !== resource) return false;
      return p.actions.includes(action) || p.actions.includes('all') || p.actions.includes('*');
    });
    return { message: 'Permission check complete', data: allowed, code: 200 };
  } catch (error) {
    console.error('Error checking user permission:', error);
    return { message: 'Failed to check user permission', data: false, code: 500 };
  }
};

// Check a single role's permission
const checkPermission = async (roleId: string, resource: string, action: string) => {
  try {
    const role = await Role.findById(roleId);
    if (!role) return { message: 'Role not found', data: false, code: 404 };
    const allowed = role.permissions?.some((p) => {
      if (p.resource !== resource) return false;
      return p.actions.includes(action) || p.actions.includes('all') || p.actions.includes('*');
    });
    return { message: 'Role permission check complete', data: !!allowed, code: 200 };
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

const RoleService = {
  createRole,
  getAllRoles,
  getRoleById,
  updateRole,
  deleteRole,
  addPermissionToRole,
  removePermissionFromRole,
  assignRoleToUser,
  removeRoleFromUser,
  getUserRoles,
  getUserPermissions,
  checkUserPermission,
  checkPermission,
  getRolePermissions,
};

export default RoleService;
