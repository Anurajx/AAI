"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const procurementController_1 = require("../controllers/procurementController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateJWT);
// Requisitions
router.get('/requisitions', procurementController_1.getRequisitions);
router.post('/requisitions', procurementController_1.createRequisition);
router.patch('/requisitions/:id/approve', procurementController_1.approveRequisition);
router.post('/requisitions/:id/fulfill', procurementController_1.fulfillRequisition);
// Purchase Orders
router.get('/purchase-orders', procurementController_1.getPOs);
router.post('/purchase-orders', procurementController_1.createPO);
router.get('/purchase-orders/suggestions', procurementController_1.suggestPO);
router.patch('/purchase-orders/:id/approve', procurementController_1.approvePO);
router.post('/purchase-orders/:id/order', procurementController_1.orderPO);
router.post('/purchase-orders/:id/receive', procurementController_1.receivePO);
exports.default = router;
