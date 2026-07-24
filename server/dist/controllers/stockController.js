"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransactions = exports.transferStock = exports.adjustStock = exports.getStockLevels = void 0;
const db_1 = require("../db");
const schemas_1 = require("../validation/schemas");
const scope_1 = require("../utils/scope");
const audit_1 = require("../utils/audit");
const notifications_1 = require("../utils/notifications");
const client_1 = require("@prisma/client");
// Get current stock levels (filtered and scoped)
const getStockLevels = async (req, res) => {
    try {
        const scope = (0, scope_1.getAirportScope)(req.user);
        const { itemId, warehouseId } = req.query;
        const where = {};
        if (itemId) {
            where.itemId = String(itemId);
        }
        const warehouseFilter = {};
        if (scope.airportId) {
            warehouseFilter.airportId = scope.airportId;
        }
        if (warehouseId) {
            warehouseFilter.id = String(warehouseId);
        }
        if (Object.keys(warehouseFilter).length > 0) {
            where.warehouse = warehouseFilter;
        }
        const stockLevels = await db_1.prisma.stockLevel.findMany({
            where,
            include: {
                item: { include: { category: true } },
                warehouse: { include: { airport: true } }
            },
            orderBy: { item: { name: 'asc' } }
        });
        return res.status(200).json({ success: true, data: stockLevels });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch stock levels' });
    }
};
exports.getStockLevels = getStockLevels;
// Adjust stock levels (damages, recount, returns)
const adjustStock = async (req, res) => {
    try {
        if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'AIRPORT_MGR' && req.user.role !== 'STAFF')) {
            return res.status(403).json({ success: false, error: 'Unauthorized to adjust stock levels' });
        }
        const parseResult = schemas_1.StockAdjustSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
        }
        const { itemId, warehouseId, quantity, transactionType, reason } = parseResult.data;
        // Verify warehouse airport scope
        const warehouse = await db_1.prisma.warehouse.findUnique({ where: { id: warehouseId } });
        if (!warehouse) {
            return res.status(404).json({ success: false, error: 'Warehouse not found' });
        }
        if (req.user.role !== 'SUPER_ADMIN' && req.user.airportId !== warehouse.airportId) {
            return res.status(403).json({ success: false, error: 'Forbidden: Warehouse belongs to another airport' });
        }
        const item = await db_1.prisma.item.findUnique({ where: { id: itemId } });
        if (!item) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }
        // Begin database transaction
        const result = await db_1.prisma.$transaction(async (tx) => {
            // Find or create StockLevel
            let stockLevel = await tx.stockLevel.findUnique({
                where: { itemId_warehouseId: { itemId, warehouseId } }
            });
            if (!stockLevel) {
                stockLevel = await tx.stockLevel.create({
                    data: { itemId, warehouseId, quantity: 0, reservedQuantity: 0, availableQuantity: 0 }
                });
            }
            const originalStockLevel = { ...stockLevel };
            // Calculate new quantity
            let newQty = stockLevel.quantity;
            const isAddition = ['IN', 'RETURNED'].includes(transactionType);
            const isSubtraction = ['OUT', 'DAMAGED'].includes(transactionType);
            if (isAddition || (transactionType === 'ADJUSTMENT' && quantity > 0)) {
                newQty += Math.abs(quantity);
            }
            else if (isSubtraction || (transactionType === 'ADJUSTMENT' && quantity < 0)) {
                newQty -= Math.abs(quantity);
            }
            if (newQty < 0) {
                throw new Error('Stock adjustment would result in negative inventory quantity');
            }
            // Update Stock Level
            const updatedStockLevel = await tx.stockLevel.update({
                where: { id: stockLevel.id },
                data: {
                    quantity: newQty,
                    availableQuantity: newQty - stockLevel.reservedQuantity
                },
                include: { warehouse: { include: { airport: true } } }
            });
            // Create Stock Transaction
            const transaction = await tx.stockTransaction.create({
                data: {
                    transactionType: transactionType,
                    itemId,
                    warehouseId,
                    quantity: Math.abs(quantity),
                    performedByUserId: req.user.userId,
                    reason,
                    referenceNumber: `ADJ-${Date.now().toString().slice(-6)}`
                }
            });
            // Log to Audit trail
            await (0, audit_1.logAudit)(req.user.userId, 'STOCK_ADJUSTMENT', 'StockLevel', stockLevel.id, originalStockLevel, updatedStockLevel);
            return { updatedStockLevel, transaction };
        });
        // Check low stock and trigger alerts
        if (result.updatedStockLevel.quantity <= item.reorderThreshold) {
            const message = `Item "${item.name}" (${item.skuCode}) at ${result.updatedStockLevel.warehouse.name} is low on stock (${result.updatedStockLevel.quantity} units left).`;
            await (0, notifications_1.notifyUsersByRole)('AIRPORT_MGR', 'Low Stock Warning', message, 'LOW_STOCK', warehouse.airportId);
            await (0, notifications_1.notifyUsersByRole)('SUPER_ADMIN', 'Low Stock Warning', message, 'LOW_STOCK');
        }
        return res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        return res.status(400).json({ success: false, error: error.message || 'Failed to adjust stock' });
    }
};
exports.adjustStock = adjustStock;
// Transfer stock between warehouses (at same airport or across airports)
const transferStock = async (req, res) => {
    try {
        if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'AIRPORT_MGR' && req.user.role !== 'STAFF')) {
            return res.status(403).json({ success: false, error: 'Unauthorized to transfer stock' });
        }
        const parseResult = schemas_1.StockTransferSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
        }
        const { itemId, sourceWarehouseId, targetWarehouseId, quantity } = parseResult.data;
        if (sourceWarehouseId === targetWarehouseId) {
            return res.status(400).json({ success: false, error: 'Source and target warehouses must be different' });
        }
        // Verify source warehouse details
        const sourceWh = await db_1.prisma.warehouse.findUnique({ where: { id: sourceWarehouseId } });
        if (!sourceWh) {
            return res.status(404).json({ success: false, error: 'Source warehouse not found' });
        }
        if (req.user.role !== 'SUPER_ADMIN' && req.user.airportId !== sourceWh.airportId) {
            return res.status(403).json({ success: false, error: 'Forbidden: Source warehouse belongs to another airport' });
        }
        const targetWh = await db_1.prisma.warehouse.findUnique({ where: { id: targetWarehouseId } });
        if (!targetWh) {
            return res.status(404).json({ success: false, error: 'Target warehouse not found' });
        }
        const item = await db_1.prisma.item.findUnique({ where: { id: itemId } });
        if (!item) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }
        // Transaction execution
        const result = await db_1.prisma.$transaction(async (tx) => {
            // Find source StockLevel
            const sourceStock = await tx.stockLevel.findUnique({
                where: { itemId_warehouseId: { itemId, warehouseId: sourceWarehouseId } }
            });
            if (!sourceStock || sourceStock.availableQuantity < quantity) {
                throw new Error(`Insufficient available stock at source warehouse. Available: ${sourceStock?.availableQuantity || 0}`);
            }
            // Find or create target StockLevel
            let targetStock = await tx.stockLevel.findUnique({
                where: { itemId_warehouseId: { itemId, warehouseId: targetWarehouseId } }
            });
            if (!targetStock) {
                targetStock = await tx.stockLevel.create({
                    data: { itemId, warehouseId: targetWarehouseId, quantity: 0, reservedQuantity: 0, availableQuantity: 0 }
                });
            }
            // Update source
            const updatedSource = await tx.stockLevel.update({
                where: { id: sourceStock.id },
                data: {
                    quantity: sourceStock.quantity - quantity,
                    availableQuantity: sourceStock.availableQuantity - quantity
                }
            });
            // Update target
            const updatedTarget = await tx.stockLevel.update({
                where: { id: targetStock.id },
                data: {
                    quantity: targetStock.quantity + quantity,
                    availableQuantity: targetStock.availableQuantity + quantity
                }
            });
            // Log Stock Transaction of type TRANSFER
            const transaction = await tx.stockTransaction.create({
                data: {
                    transactionType: client_1.TransactionType.TRANSFER,
                    itemId,
                    warehouseId: sourceWarehouseId,
                    targetWarehouseId: targetWarehouseId,
                    quantity,
                    performedByUserId: req.user.userId,
                    reason: `Inter-warehouse transfer from ${sourceWh.name} to ${targetWh.name}`,
                    referenceNumber: `TRF-${Date.now().toString().slice(-6)}`
                }
            });
            await (0, audit_1.logAudit)(req.user.userId, 'STOCK_TRANSFER', 'StockLevel', sourceStock.id, sourceStock, updatedSource);
            await (0, audit_1.logAudit)(req.user.userId, 'STOCK_TRANSFER', 'StockLevel', targetStock.id, targetStock, updatedTarget);
            return { updatedSource, updatedTarget, transaction };
        });
        return res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        return res.status(400).json({ success: false, error: error.message || 'Failed to complete transfer' });
    }
};
exports.transferStock = transferStock;
// Retrieve historical stock movements (transactions log)
const getTransactions = async (req, res) => {
    try {
        const scope = (0, scope_1.getAirportScope)(req.user);
        const { itemId, warehouseId, type } = req.query;
        const where = {};
        if (itemId) {
            where.itemId = String(itemId);
        }
        if (type) {
            where.transactionType = type;
        }
        // Scoped warehouse filter
        const warehouseFilter = {};
        if (scope.airportId) {
            warehouseFilter.airportId = scope.airportId;
        }
        if (warehouseId) {
            warehouseFilter.id = String(warehouseId);
        }
        if (Object.keys(warehouseFilter).length > 0) {
            where.OR = [
                { warehouse: warehouseFilter },
                { targetWarehouse: warehouseFilter }
            ];
        }
        const transactions = await db_1.prisma.stockTransaction.findMany({
            where,
            include: {
                item: true,
                warehouse: { include: { airport: true } },
                targetWarehouse: { include: { airport: true } },
                performedByUser: { select: { name: true, employeeId: true, role: true } }
            },
            orderBy: { timestamp: 'desc' }
        });
        return res.status(200).json({ success: true, data: transactions });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch transactions history' });
    }
};
exports.getTransactions = getTransactions;
