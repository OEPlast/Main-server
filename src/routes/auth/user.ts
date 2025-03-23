import AuthController from '@/controller/authController';
import express from 'express';
const router = express.Router();

router.post('/logout', () => {});
router.post('/login', AuthController.userLogin);
router.post('/register', AuthController.userRegister);
router.post('/changePassword', AuthController.updateUserPassword);
router.post('/requestResetPasswordCode', AuthController.requestResetPasswordCode);
router.post('/resetPasswordByCode', AuthController.resetUserPasswordByCode);
router.post('/verifyAccountOtp', AuthController.verifyAccountOtp);
router.post('/resendVerifyAccountOtp', AuthController.resendVerifyAccountOtp);

export default router;
