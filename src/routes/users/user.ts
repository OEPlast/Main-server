import express from 'express';
import { userLogin, userLogout, userRegister } from '../../controller/authController';

const router = express.Router();

router.post('/login', userLogin);
router.post('/logout', userLogout);
router.post('/register', userRegister);

export default router;
