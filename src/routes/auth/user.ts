import AuthController from '@/controller/authController';
import express from 'express';
const router = express.Router();

router.post('/login', () => {});
router.post('/logout', () => {});
router.post('/register', AuthController.userRegister);

export default router;
