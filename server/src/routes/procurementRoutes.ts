import { Router } from 'express';
import {
  createRequisition,
  getRequisitions,
  approveRequisition,
  fulfillRequisition,
  createPO,
  getPOs,
  approvePO,
  orderPO,
  receivePO,
  suggestPO
} from '../controllers/procurementController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT as any);

// Requisitions
router.get('/requisitions', getRequisitions as any);
router.post('/requisitions', createRequisition as any);
router.patch('/requisitions/:id/approve', approveRequisition as any);
router.post('/requisitions/:id/fulfill', fulfillRequisition as any);

// Purchase Orders
router.get('/purchase-orders', getPOs as any);
router.post('/purchase-orders', createPO as any);
router.get('/purchase-orders/suggestions', suggestPO as any);
router.patch('/purchase-orders/:id/approve', approvePO as any);
router.post('/purchase-orders/:id/order', orderPO as any);
router.post('/purchase-orders/:id/receive', receivePO as any);

export default router;
