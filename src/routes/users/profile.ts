import express from 'express';
import UserController from '../../controller/UserController';
import UserValidator from '../../validators/UserValidator';
import { isAuthenticated } from '../../middleware/auth';

const router = express.Router();

// All profile routes require authentication
router.use(isAuthenticated);

// Get user profile
router.get('/', UserController.getProfile);

// Update user profile
router.put('/', ...UserValidator.validateUserProfileUpdate, UserController.updateProfile);

// Change password
router.put('/password', UserController.changePassword);

// Add address
router.post('/addresses', UserController.addAddress);

// Update address
router.put('/addresses/:addressId', UserController.updateAddress);

// Delete address
router.delete('/addresses/:addressId', UserController.deleteAddress);

// Get all addresses
router.get('/addresses', UserController.getAddresses);

export default router;
