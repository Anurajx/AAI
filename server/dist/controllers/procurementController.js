"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.suggestPO = exports.receivePO = exports.orderPO = exports.approvePO = exports.getPOs = exports.createPO = exports.fulfillRequisition = exports.approveRequisition = exports.getRequisitions = exports.createRequisition = void 0;
const db_1 = require("../db");
const schemas_1 = require("../validation/schemas");
const scope_1 = require("../utils/scope");
const audit_1 = require("../utils/audit");
const notifications_1 = require("../utils/notifications");
const client_1 = require("@prisma/client");
// ==========================================
// REQUISITIONS (INTERNAL DEMAND)
// ==========================================
const createRequisition = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        const parseResult = schemas_1.RequisitionSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
        }
        const { requestingDepartment, airportId, items } = parseResult.data;
        // Check airport scope
        if (req.user.role !== 'SUPER_ADMIN' && req.user.airportId !== airportId) {
            return res.status(403).json({ success: false, error: 'Forbidden: Cannot create requisition for another airport' });
        }
        const count = await db_1.prisma.requisition.count();
        const reqNumber = `REQ-2026-${(count + 1).toString().padStart(4, '0')}`;
        const result = await db_1.prisma.$transaction(async (tx) => {
            const requisition = await tx.requisition.create({
                data: {
                    reqNumber,
                    requestingDepartment,
                    airportId,
                    requestedByUserId: req.user.userId,
                    status: client_1.ReqStatus.PENDING
                }
            });
            const reqItems = await Promise.all(items.map(item => tx.requisitionItem.create({
                data: {
                    requisitionId: requisition.id,
                    itemId: item.itemId,
                    quantityRequested: item.quantityRequested
                }
            })));
            return { requisition, reqItems };
        });
        // Notify Airport Managers
        const message = `New requisition ${reqNumber} submitted by ${req.user.employeeId} for department ${requestingDepartment}.`;
        await (0, notifications_1.notifyUsersByRole)('AIRPORT_MGR', 'Requisition Pending Approval', message, 'REQUISITION_APPROVAL', airportId);
        await (0, notifications_1.notifyUsersByRole)('SUPER_ADMIN', 'Requisition Pending Approval', message, 'REQUISITION_APPROVAL');
        await (0, audit_1.logAudit)(req.user.userId, 'CREATE_REQUISITION', 'Requisition', result.requisition.id, null, result);
        return res.status(201).json({ success: true, data: result });
    }
    catch (error) {
        console.error('Requisition creation error:', error);
        return res.status(500).json({ success: false, error: 'Failed to create requisition' });
    }
};
exports.createRequisition = createRequisition;
const getRequisitions = async (req, res) => {
    try {
        const scope = (0, scope_1.getAirportScope)(req.user);
        const where = {};
        if (scope.airportId) {
            where.airportId = scope.airportId;
        }
        const requisitions = await db_1.prisma.requisition.findMany({
            where,
            include: {
                airport: true,
                requestedByUser: { select: { name: true, employeeId: true } },
                approvedByUser: { select: { name: true, employeeId: true } },
                items: { include: { item: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        return res.status(200).json({ success: true, data: requisitions });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch requisitions' });
    }
};
exports.getRequisitions = getRequisitions;
const approveRequisition = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'AIRPORT_MGR')) {
            return res.status(403).json({ success: false, error: 'Unauthorized to approve requisitions' });
        }
        const parseResult = schemas_1.RequisitionApproveSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
        }
        const { status, comments } = parseResult.data;
        const requisition = await db_1.prisma.requisition.findUnique({
            where: { id },
            include: { items: true }
        });
        if (!requisition) {
            return res.status(404).json({ success: false, error: 'Requisition not found' });
        }
        if (requisition.status !== client_1.ReqStatus.PENDING) {
            return res.status(400).json({ success: false, error: 'Requisition has already been processed' });
        }
        if (req.user.role !== 'SUPER_ADMIN' && req.user.airportId !== requisition.airportId) {
            return res.status(403).json({ success: false, error: 'Forbidden: Airport scope mismatch' });
        }
        const result = await db_1.prisma.$transaction(async (tx) => {
            // If approved, reserve the stock in the main warehouse of this airport
            if (status === 'APPROVED') {
                const warehouse = await tx.warehouse.findFirst({
                    where: { airportId: requisition.airportId }
                });
                if (!warehouse) {
                    throw new Error('No warehouses configured for this airport to allocate stock from');
                }
                for (const reqItem of requisition.items) {
                    let stock = await tx.stockLevel.findUnique({
                        where: { itemId_warehouseId: { itemId: reqItem.itemId, warehouseId: warehouse.id } }
                    });
                    if (!stock || stock.availableQuantity < reqItem.quantityRequested) {
                        const itemDetails = await tx.item.findUnique({ where: { id: reqItem.itemId } });
                        throw new Error(`Insufficient available stock for item "${itemDetails?.name}". Available: ${stock?.availableQuantity || 0}, Requested: ${reqItem.quantityRequested}`);
                    }
                    // Update stock reservation
                    await tx.stockLevel.update({
                        where: { id: stock.id },
                        data: {
                            reservedQuantity: stock.reservedQuantity + reqItem.quantityRequested,
                            availableQuantity: stock.availableQuantity - reqItem.quantityRequested
                        }
                    });
                }
            }
            const updatedReq = await tx.requisition.update({
                where: { id },
                data: {
                    status: status,
                    approvedByUserId: req.user.userId,
                    comments
                },
                include: { requestedByUser: true }
            });
            return updatedReq;
        });
        // Notify requester
        await (0, notifications_1.createNotification)(requisition.requestedByUserId, `Requisition ${requisition.reqNumber} ${status}`, `Your requisition request was ${status.toLowerCase()} by regional manager. Comments: ${comments || 'None'}`, 'REQUISITION');
        await (0, audit_1.logAudit)(req.user.userId, `REQUISITION_${status}`, 'Requisition', id, requisition, result);
        return res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        return res.status(400).json({ success: false, error: error.message || 'Failed to approve requisition' });
    }
};
exports.approveRequisition = approveRequisition;
const fulfillRequisition = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'AIRPORT_MGR' && req.user.role !== 'STAFF')) {
            return res.status(403).json({ success: false, error: 'Unauthorized to dispatch requisitions' });
        }
        const requisition = await db_1.prisma.requisition.findUnique({
            where: { id },
            include: { items: { include: { item: true } } }
        });
        if (!requisition) {
            return res.status(404).json({ success: false, error: 'Requisition not found' });
        }
        if (requisition.status !== client_1.ReqStatus.APPROVED) {
            return res.status(400).json({ success: false, error: 'Requisition must be APPROVED before dispatch' });
        }
        if (req.user.role !== 'SUPER_ADMIN' && req.user.airportId !== requisition.airportId) {
            return res.status(403).json({ success: false, error: 'Forbidden: Airport scope mismatch' });
        }
        const result = await db_1.prisma.$transaction(async (tx) => {
            const warehouse = await tx.warehouse.findFirst({
                where: { airportId: requisition.airportId }
            });
            if (!warehouse)
                throw new Error('Warehouse not found');
            for (const reqItem of requisition.items) {
                const stock = await tx.stockLevel.findUnique({
                    where: { itemId_warehouseId: { itemId: reqItem.itemId, warehouseId: warehouse.id } }
                });
                if (!stock)
                    throw new Error('Stock level record not found');
                // Fulfill and release reservation
                await tx.stockLevel.update({
                    where: { id: stock.id },
                    data: {
                        quantity: stock.quantity - reqItem.quantityRequested,
                        reservedQuantity: Math.max(0, stock.reservedQuantity - reqItem.quantityRequested)
                    }
                });
                // Record stock transaction (OUT)
                await tx.stockTransaction.create({
                    data: {
                        transactionType: client_1.TransactionType.OUT,
                        itemId: reqItem.itemId,
                        warehouseId: warehouse.id,
                        quantity: reqItem.quantityRequested,
                        referenceNumber: requisition.reqNumber,
                        performedByUserId: req.user.userId,
                        reason: `Requisition Fulfill - Department: ${requisition.requestingDepartment}`
                    }
                });
                // Track quantity fulfilled
                await tx.requisitionItem.update({
                    where: { id: reqItem.id },
                    data: { quantityFulfilled: reqItem.quantityRequested }
                });
            }
            const fulfilledReq = await tx.requisition.update({
                where: { id },
                data: { status: client_1.ReqStatus.FULFILLED }
            });
            return fulfilledReq;
        });
        await (0, audit_1.logAudit)(req.user.userId, 'FULFILL_REQUISITION', 'Requisition', id, requisition, result);
        return res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        return res.status(400).json({ success: false, error: error.message || 'Failed to fulfill requisition' });
    }
};
exports.fulfillRequisition = fulfillRequisition;
// ==========================================
// PURCHASE ORDERS (PROCUREMENT)
// ==========================================
const createPO = async (req, res) => {
    try {
        if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'AIRPORT_MGR')) {
            return res.status(403).json({ success: false, error: 'Unauthorized to create Purchase Orders' });
        }
        const parseResult = schemas_1.PurchaseOrderSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
        }
        const { supplierId, expectedDeliveryDate, items } = parseResult.data;
        const count = await db_1.prisma.purchaseOrder.count();
        const poNumber = `PO-2026-${(count + 1).toString().padStart(4, '0')}`;
        const totalCost = items.reduce((sum, item) => sum + (item.quantityOrdered * item.unitCost), 0);
        const result = await db_1.prisma.$transaction(async (tx) => {
            const po = await tx.purchaseOrder.create({
                data: {
                    poNumber,
                    supplierId,
                    status: client_1.POStatus.DRAFT,
                    totalCost,
                    expectedDeliveryDate: new Date(expectedDeliveryDate),
                    createdByUserId: req.user.userId
                }
            });
            const poItems = await Promise.all(items.map(item => tx.purchaseOrderItem.create({
                data: {
                    purchaseOrderId: po.id,
                    itemId: item.itemId,
                    quantityOrdered: item.quantityOrdered,
                    unitCost: item.unitCost
                }
            })));
            return { po, poItems };
        });
        // Notify Super Admin if created by Manager
        if (req.user.role === 'AIRPORT_MGR') {
            await (0, notifications_1.notifyUsersByRole)('SUPER_ADMIN', 'Purchase Order Pending Approval', `Regional Manager submitted PO ${poNumber} for approval. Total Value: INR ${totalCost.toLocaleString()}`, 'PO_STATUS');
        }
        await (0, audit_1.logAudit)(req.user.userId, 'CREATE_PO', 'PurchaseOrder', result.po.id, null, result);
        return res.status(201).json({ success: true, data: result });
    }
    catch (error) {
        console.error('PO Creation error:', error);
        return res.status(500).json({ success: false, error: 'Failed to create Purchase Order' });
    }
};
exports.createPO = createPO;
const getPOs = async (req, res) => {
    try {
        const scope = (0, scope_1.getAirportScope)(req.user);
        const where = {};
        // Scope POs to the user's airport based on the creator's assigned airport
        if (scope.airportId) {
            where.createdByUser = { airportId: scope.airportId };
        }
        const pos = await db_1.prisma.purchaseOrder.findMany({
            where,
            include: {
                supplier: true,
                createdByUser: { select: { name: true, employeeId: true } },
                approvedByUser: { select: { name: true, employeeId: true } },
                items: { include: { item: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        return res.status(200).json({ success: true, data: pos });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch Purchase Orders' });
    }
};
exports.getPOs = getPOs;
const approvePO = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.user || req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ success: false, error: 'Only Super Admins can approve procurement Purchase Orders' });
        }
        const po = await db_1.prisma.purchaseOrder.findUnique({ where: { id } });
        if (!po)
            return res.status(404).json({ success: false, error: 'Purchase Order not found' });
        if (po.status !== client_1.POStatus.DRAFT && po.status !== client_1.POStatus.PENDING_APPROVAL) {
            return res.status(400).json({ success: false, error: 'Purchase Order is not in draft or pending state' });
        }
        const updatedPo = await db_1.prisma.purchaseOrder.update({
            where: { id },
            data: {
                status: client_1.POStatus.APPROVED,
                approvedByUserId: req.user.userId
            }
        });
        // Notify regional manager creator
        await (0, notifications_1.createNotification)(po.createdByUserId, `PO ${po.poNumber} Approved`, `Your Purchase Order was approved. You can now transmit it to the vendor.`, 'PO_STATUS');
        await (0, audit_1.logAudit)(req.user.userId, 'APPROVE_PO', 'PurchaseOrder', id, po, updatedPo);
        return res.status(200).json({ success: true, data: updatedPo });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to approve Purchase Order' });
    }
};
exports.approvePO = approvePO;
const orderPO = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'AIRPORT_MGR')) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }
        const po = await db_1.prisma.purchaseOrder.findUnique({ where: { id } });
        if (!po)
            return res.status(404).json({ success: false, error: 'PO not found' });
        if (po.status !== client_1.POStatus.APPROVED) {
            return res.status(400).json({ success: false, error: 'PO must be approved before ordering' });
        }
        const updatedPo = await db_1.prisma.purchaseOrder.update({
            where: { id },
            data: { status: client_1.POStatus.ORDERED }
        });
        await (0, audit_1.logAudit)(req.user.userId, 'ORDER_PO', 'PurchaseOrder', id, po, updatedPo);
        return res.status(200).json({ success: true, data: updatedPo });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to update PO status' });
    }
};
exports.orderPO = orderPO;
const receivePO = async (req, res) => {
    try {
        const { id } = req.params;
        const { warehouseId } = req.body; // Warehouse where goods will be received
        if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'AIRPORT_MGR' && req.user.role !== 'STAFF')) {
            return res.status(403).json({ success: false, error: 'Unauthorized to receive shipments' });
        }
        const parseResult = schemas_1.POReceiveSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
        }
        if (!warehouseId) {
            return res.status(400).json({ success: false, error: 'warehouseId is required' });
        }
        const po = await db_1.prisma.purchaseOrder.findUnique({
            where: { id },
            include: { items: true }
        });
        if (!po)
            return res.status(404).json({ success: false, error: 'PO not found' });
        if (po.status !== client_1.POStatus.ORDERED && po.status !== client_1.POStatus.PARTIALLY_RECEIVED) {
            return res.status(400).json({ success: false, error: 'PO is not in ORDERED or PARTIALLY_RECEIVED state' });
        }
        const wh = await db_1.prisma.warehouse.findUnique({ where: { id: warehouseId } });
        if (!wh)
            return res.status(404).json({ success: false, error: 'Selected receiving warehouse not found' });
        if (req.user.role !== 'SUPER_ADMIN' && req.user.airportId !== wh.airportId) {
            return res.status(403).json({ success: false, error: 'Forbidden: Warehouse belongs to another airport' });
        }
        const { items: receivedItems } = parseResult.data;
        const result = await db_1.prisma.$transaction(async (tx) => {
            let allReceived = true;
            for (const reqItem of po.items) {
                const itemRx = receivedItems.find(x => x.itemId === reqItem.itemId);
                const addQty = itemRx ? itemRx.quantityReceived : 0;
                const newRxCount = reqItem.quantityReceived + addQty;
                if (newRxCount > reqItem.quantityOrdered) {
                    throw new Error(`Cannot receive more than quantity ordered for item ID: ${reqItem.itemId}`);
                }
                // Update PO item progress
                await tx.purchaseOrderItem.update({
                    where: { id: reqItem.id },
                    data: { quantityReceived: newRxCount }
                });
                if (newRxCount < reqItem.quantityOrdered) {
                    allReceived = false;
                }
                if (addQty > 0) {
                    // Update Stock Level
                    let stock = await tx.stockLevel.findUnique({
                        where: { itemId_warehouseId: { itemId: reqItem.itemId, warehouseId } }
                    });
                    if (!stock) {
                        stock = await tx.stockLevel.create({
                            data: { itemId: reqItem.itemId, warehouseId, quantity: 0, reservedQuantity: 0, availableQuantity: 0 }
                        });
                    }
                    await tx.stockLevel.update({
                        where: { id: stock.id },
                        data: {
                            quantity: stock.quantity + addQty,
                            availableQuantity: stock.availableQuantity + addQty
                        }
                    });
                    // Write Stock Transaction (IN)
                    await tx.stockTransaction.create({
                        data: {
                            transactionType: client_1.TransactionType.IN,
                            itemId: reqItem.itemId,
                            warehouseId,
                            quantity: addQty,
                            referenceNumber: po.poNumber,
                            performedByUserId: req.user.userId,
                            reason: 'Procurement PO Delivery Inbound'
                        }
                    });
                }
            }
            // Update PO Status
            const finalStatus = allReceived ? client_1.POStatus.RECEIVED : client_1.POStatus.PARTIALLY_RECEIVED;
            const updatedPo = await tx.purchaseOrder.update({
                where: { id },
                data: { status: finalStatus }
            });
            return updatedPo;
        });
        await (0, audit_1.logAudit)(req.user.userId, 'RECEIVE_PO_GOODS', 'PurchaseOrder', id, po, result);
        return res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        return res.status(400).json({ success: false, error: error.message || 'Failed to process PO receipt' });
    }
};
exports.receivePO = receivePO;
const suggestPO = async (req, res) => {
    try {
        const scope = (0, scope_1.getAirportScope)(req.user);
        // Fetch all stock levels filterable by user scope
        const allStock = await db_1.prisma.stockLevel.findMany({
            where: scope.airportId ? { warehouse: { airportId: scope.airportId } } : {},
            include: { item: { include: { supplier: true } }, warehouse: true }
        });
        // Group items and aggregate stock levels
        const itemMap = new Map();
        for (const sl of allStock) {
            const entry = itemMap.get(sl.itemId) || { item: sl.item, totalQty: 0, warehouses: [] };
            entry.totalQty += sl.quantity;
            entry.warehouses.push({ warehouseName: sl.warehouse.name, qty: sl.quantity });
            itemMap.set(sl.itemId, entry);
        }
        const suggestions = Array.from(itemMap.values())
            .filter(entry => entry.totalQty <= entry.item.reorderThreshold)
            .map(entry => ({
            itemId: entry.item.id,
            name: entry.item.name,
            skuCode: entry.item.skuCode,
            currentStock: entry.totalQty,
            reorderThreshold: entry.item.reorderThreshold,
            suggestedOrderQty: entry.item.reorderQuantity,
            unitCost: entry.item.unitCost,
            supplier: entry.item.supplier
        }));
        return res.status(200).json({ success: true, data: suggestions });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch reorder suggestions' });
    }
};
exports.suggestPO = suggestPO;
