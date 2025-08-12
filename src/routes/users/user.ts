import express from 'express';
import AuthController from '../../controller/authController';
import UserController from '../../controller/UserController';
import UserValidator from '../../validators/UserValidator';

const router = express.Router();

router.post('/login', AuthController.userLogin);
router.post('/logout', AuthController.userLogout);
router.post('/register', AuthController.userRegister);

// Update user profile
router.put('/profile', UserValidator.validateUserProfileUpdate, UserController.updateProfile);

// Update user settings
router.put('/settings', UserValidator.validateUserSettingsUpdate, UserController.updateSettings);

export default router;
