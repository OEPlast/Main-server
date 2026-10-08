import express from 'express';
import UserController from '../../controller/UserController';
import UserValidator from '../../validators/UserValidator';
import { authenticateUser } from '@/middleware/auth';

const router = express.Router();

router.use(authenticateUser);

router.get('/profile', UserController.getProfile);

// The signed-in account with email, phone and default address in one call
router.get('/me', UserController.getMe);

// Update user profile
router.put('/profile', UserValidator.validateUserProfileUpdate, UserController.updateProfile);

router.post('/address', UserValidator.validateAddAddress, UserController.addAddress);

router.get('/address/all', UserController.getAddresses);

router.put('/address/:addressId', UserValidator.validateUpdateAddress, UserController.updateAddress);

router.delete('/address/:addressId', UserValidator.validateDeleteAddress, UserController.deleteAddress);

export default router;
