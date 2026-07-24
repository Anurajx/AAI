import { Router } from 'express';
import { getStockLevels, adjustStock, transferStock, getTransactions } from '../controllers/stockController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT as any);

router.get('/stock', getStockLevels as any);
router.post('/stock/adjust', adjustStock as any);
router.post('/stock/transfer', transferStock as any);
router.get('/transactions', getTransactions as any);

export default router;
