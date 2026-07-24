import { Router } from 'express';
import {
  getValuationReport,
  getVelocityReport,
  getReorderReport,
  exportPDF,
  exportExcel
} from '../controllers/reportsController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT as any);

router.get('/valuation', getValuationReport as any);
router.get('/velocity', getVelocityReport as any);
router.get('/reorder', getReorderReport as any);
router.get('/export/pdf', exportPDF as any);
router.get('/export/excel', exportExcel as any);

export default router;
