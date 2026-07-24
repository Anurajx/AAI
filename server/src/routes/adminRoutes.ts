import { Router } from 'express';
import { getUsers, createUser, updateUser, getAuditLogs } from '../controllers/adminController';
import { authenticateJWT, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT as any);
router.use(requireRole(['SUPER_ADMIN', 'AUDITOR']) as any);

router.get('/users', getUsers as any);
router.post('/users', createUser as any);
router.put('/users/:id', updateUser as any);
router.get('/audit-log', getAuditLogs as any);

export default router;
