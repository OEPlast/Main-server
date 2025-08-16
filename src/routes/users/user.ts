import express from 'express';
import UserController from '../../controller/UserController';
import UserValidator from '../../validators/UserValidator';
import { authenticateUser } from '@/middleware/auth';

const router = express.Router();

router.use(authenticateUser);

router.get('/profile', UserController.getProfile);

// Update user profile
router.put('/profile', UserValidator.validateUserProfileUpdate, UserController.updateProfile);

// Update user settings
router.put('/settings', UserValidator.validateUserSettingsUpdate, UserController.updateSettings);

router.post('/addresses', UserController.addAddress);

router.put('/addresses/:addressId', UserController.updateAddress);

router.delete('/addresses/:addressId', UserController.deleteAddress);

router.get('/addresses', UserController.getAddresses);

export default router;
