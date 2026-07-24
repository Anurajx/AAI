import { Router } from 'express';
import {
  getAirports,
  getWarehouses,
  getCategories,
  getSuppliers,
  getItems,
  getItemDetail,
  createItem,
  updateItem
} from '../controllers/inventoryController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT as any);

router.get('/airports', getAirports as any);
router.get('/warehouses', getWarehouses as any);
router.get('/categories', getCategories as any);
router.get('/suppliers', getSuppliers as any);

router.get('/items', getItems as any);
router.get('/items/:id', getItemDetail as any);
router.post('/items', createItem as any);
router.put('/items/:id', updateItem as any);

export default router;
