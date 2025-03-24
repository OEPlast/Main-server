import express from 'express';
const router = express.Router();
import RoleController from '@/controller/admin/RoleController';
import { isAdmin } from '@/middleware/auth';
import RoleValidator from '@/validators/admin/RoleValidator';

router.patch('/change', isAdmin, RoleValidator.updateUserRoleValidator, RoleController.updateUserRole);

export default router;
