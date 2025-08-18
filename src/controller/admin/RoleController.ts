import { Request, Response } from 'express';
import RoleService from '../../services/admin/RoleService';
import { PermissionAction, PermissionResource } from '@/types/permissions';

const createRole = async (req: Request, res: Response) => {
  try {
    const roleData = req.body;
    const result = await RoleService.createRole(roleData);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in createRole:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getAllRoles = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, isActive } = req.query;
    const result = await RoleService.getAllRoles(
      Number(page),
      Number(limit),
      isActive === 'true' ? true : isActive === 'false' ? false : undefined
    );
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getAllRoles:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getRoleById = async (req: Request, res: Response) => {
  try {
    const { roleId } = req.params;
    const result = await RoleService.getRoleById(roleId);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getRoleById:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const updateRole = async (req: Request, res: Response) => {
  try {
    const { roleId } = req.params;
    const updates = req.body;
    const result = await RoleService.updateRole(roleId, updates);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in updateRole:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteRole = async (req: Request, res: Response) => {
  try {
    const { roleId } = req.params;
    const result = await RoleService.deleteRole(roleId);
    return res.status(result.code).json({ message: result.message });
  } catch (error) {
    console.error('Error in deleteRole:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const checkPermission = async (req: Request, res: Response) => {
  try {
    const { roleId, resource, action } = req.params;
    const resourceMain = resource as PermissionResource;
    const actionMain = action as PermissionAction;
    const result = await RoleService.checkPermission(roleId, resourceMain, actionMain);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in checkPermission:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getRolePermissions = async (req: Request, res: Response) => {
  try {
    const { roleId } = req.params;
    const result = await RoleService.getRolePermissions(roleId);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getRolePermissions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const assignRoleToUser = async (req: Request, res: Response) => {
  try {
    const { userId, roleId } = req.body;
    const result = await RoleService.assignRoleToUser(userId, roleId);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in assignRoleToUser:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const removeRoleFromUser = async (req: Request, res: Response) => {
  try {
    const { userId, roleId } = req.body;
    const result = await RoleService.removeRoleFromUser(userId, roleId);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in removeRoleFromUser:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getUserRoles = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await RoleService.getUserRoles(userId);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getUserRoles:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getUserPermissions = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await RoleService.getUserPermissions(userId);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getUserPermissions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const checkUserPermission = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { resource, action } = req.body as { resource: PermissionResource; action: PermissionAction };
    const result = await RoleService.checkUserPermission(
      userId,
      resource as PermissionResource,
      action as PermissionAction
    );
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in checkUserPermission:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getUsersByRole = async (req: Request, res: Response) => {
  try {
    const { roleId } = req.params;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const result = await RoleService.getUsersByRole(roleId, page, limit);
    return res.status(result.code).json({ message: result.message, data: result.data });
  } catch (error) {
    console.error('Error in getUsersByRole:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  createRole,
  getAllRoles,
  getRoleById,
  updateRole,
  deleteRole,
  getRolePermissions,
  assignRoleToUser,
  removeRoleFromUser,
  getUserRoles,
  getUserPermissions,
  checkUserPermission,
  checkPermission,
  getUsersByRole,
};
