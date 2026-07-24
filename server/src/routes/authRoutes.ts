import { Router } from 'express';
import { login, refresh, logout, getMe } from '../controllers/authController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', authenticateJWT as any, logout as any);
router.get('/me', authenticateJWT as any, getMe as any);

export default router;
