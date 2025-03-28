import express from 'express';
import { userLogin, userLogout, userRegister } from '../../controller/authController';
import UserController from '../../controller/userController';
import UserValidator from '../../validators/UserValidator';

const router = express.Router();

router.post('/login', userLogin);
router.post('/logout', userLogout);
router.post('/register', userRegister);

// Update user profile
router.put('/profile', UserValidator.validateUserProfileUpdate, UserController.updateProfile);

// Update user settings
router.put('/settings', UserValidator.validateUserSettingsUpdate, UserController.updateSettings);

export default router;
