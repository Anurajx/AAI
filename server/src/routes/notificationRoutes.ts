import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notificationController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT as any);

router.get('/', getNotifications as any);
router.patch('/:id/read', markAsRead as any);
router.post('/read-all', markAllAsRead as any);

export default router;
