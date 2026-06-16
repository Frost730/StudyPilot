import { Router } from 'express';
import { register, login, getMe, forgotPassword, googleLogin, guestLogin } from '../controllers/authController';
import { authenticateToken } from '../middlewares/auth';
import { authLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/google', authLimiter, googleLogin);
router.post('/guest', authLimiter, guestLogin);
router.post('/forgot-password', authLimiter, forgotPassword);
router.get('/me', authenticateToken, getMe);

export default router;
