"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateItem = exports.createItem = exports.getItemDetail = exports.getItems = exports.getSuppliers = exports.getCategories = exports.getWarehouses = exports.getAirports = void 0;
const db_1 = require("../db");
const schemas_1 = require("../validation/schemas");
const scope_1 = require("../utils/scope");
const audit_1 = require("../utils/audit");
// Airports
const getAirports = async (req, res) => {
    try {
        const scope = (0, scope_1.getAirportScope)(req.user);
        const filter = scope.airportId ? { id: scope.airportId } : {};
        const airports = await db_1.prisma.airport.findMany({
            where: filter,
            include: {
                _count: {
                    select: { warehouses: true, users: true }
                }
            }
        });
        return res.status(200).json({ success: true, data: airports });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch airports' });
    }
};
exports.getAirports = getAirports;
// Warehouses
const getWarehouses = async (req, res) => {
    try {
        const scope = (0, scope_1.getAirportScope)(req.user);
        const { airportId } = req.query;
        const filter = {};
        if (scope.airportId) {
            filter.airportId = scope.airportId;
        }
        else if (airportId) {
            filter.airportId = String(airportId);
        }
        const warehouses = await db_1.prisma.warehouse.findMany({
            where: filter,
            include: { airport: true }
        });
        return res.status(200).json({ success: true, data: warehouses });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch warehouses' });
    }
};
exports.getWarehouses = getWarehouses;
// Categories
const getCategories = async (req, res) => {
    try {
        const categories = await db_1.prisma.category.findMany({
            include: {
                _count: { select: { items: true } }
            }
        });
        return res.status(200).json({ success: true, data: categories });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch categories' });
    }
};
exports.getCategories = getCategories;
// Suppliers
const getSuppliers = async (req, res) => {
    try {
        const suppliers = await db_1.prisma.supplier.findMany({
            orderBy: { name: 'asc' }
        });
        return res.status(200).json({ success: true, data: suppliers });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch suppliers' });
    }
};
exports.getSuppliers = getSuppliers;
// Items (SKUs) - Search, Filter, Page
const getItems = async (req, res) => {
    try {
        const scope = (0, scope_1.getAirportScope)(req.user);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const { categoryId, search, status, warehouseId, airportId } = req.query;
        // Filter build
        const where = {};
        if (categoryId) {
            where.categoryId = String(categoryId);
        }
        if (search) {
            where.OR = [
                { name: { contains: String(search), mode: 'insensitive' } },
                { skuCode: { contains: String(search), mode: 'insensitive' } },
                { barcodeValue: { contains: String(search), mode: 'insensitive' } },
            ];
        }
        // Filters linked to StockLevels (airport scope, specific warehouse, specific airport)
        const stockConditions = {};
        if (scope.airportId) {
            stockConditions.warehouse = { airportId: scope.airportId };
        }
        else if (airportId) {
            stockConditions.warehouse = { airportId: String(airportId) };
        }
        if (warehouseId) {
            stockConditions.warehouseId = String(warehouseId);
        }
        if (Object.keys(stockConditions).length > 0) {
            where.stockLevels = {
                some: stockConditions
            };
        }
        // Execute query with paginated results
        const [items, total] = await db_1.prisma.$transaction([
            db_1.prisma.item.findMany({
                where,
                include: {
                    category: true,
                    supplier: true,
                    stockLevels: {
                        where: stockConditions,
                        include: { warehouse: { include: { airport: true } } }
                    }
                },
                skip,
                take: limit,
                orderBy: { name: 'asc' }
            }),
            db_1.prisma.item.count({ where })
        ]);
        // Format stock status (In stock, low stock, out of stock) in JSON response
        const formattedItems = items.map(item => {
            const totalQty = item.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0);
            let stockStatus = 'IN_STOCK';
            if (totalQty === 0) {
                stockStatus = 'OUT_OF_STOCK';
            }
            else if (totalQty <= item.reorderThreshold) {
                stockStatus = 'LOW_STOCK';
            }
            return {
                ...item,
                totalQuantity: totalQty,
                stockStatus
            };
        });
        // If status filter is requested
        let finalItems = formattedItems;
        if (status) {
            finalItems = formattedItems.filter(item => item.stockStatus === String(status));
        }
        return res.status(200).json({
            success: true,
            data: finalItems,
            meta: {
                page,
                limit,
                totalItems: total,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('Failed to fetch items:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch items' });
    }
};
exports.getItems = getItems;
// Item Detail
const getItemDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const scope = (0, scope_1.getAirportScope)(req.user);
        const item = await db_1.prisma.item.findUnique({
            where: { id },
            include: {
                category: true,
                supplier: true,
                stockLevels: {
                    where: scope.airportId ? { warehouse: { airportId: scope.airportId } } : {},
                    include: { warehouse: { include: { airport: true } } }
                },
                transactions: {
                    where: scope.airportId ? { warehouse: { airportId: scope.airportId } } : {},
                    include: {
                        warehouse: true,
                        targetWarehouse: true,
                        performedByUser: { select: { name: true, employeeId: true } }
                    },
                    orderBy: { timestamp: 'desc' },
                    take: 10
                }
            }
        });
        if (!item) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }
        const totalQty = item.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0);
        const stockStatus = totalQty === 0 ? 'OUT_OF_STOCK' : totalQty <= item.reorderThreshold ? 'LOW_STOCK' : 'IN_STOCK';
        return res.status(200).json({
            success: true,
            data: {
                ...item,
                totalQuantity: totalQty,
                stockStatus
            }
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch item details' });
    }
};
exports.getItemDetail = getItemDetail;
// Create Item
const createItem = async (req, res) => {
    try {
        if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'AIRPORT_MGR')) {
            return res.status(403).json({ success: false, error: 'Unauthorized to create items' });
        }
        const parseResult = schemas_1.ItemSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
        }
        const existingSku = await db_1.prisma.item.findFirst({
            where: {
                OR: [
                    { skuCode: parseResult.data.skuCode },
                    { barcodeValue: parseResult.data.barcodeValue }
                ]
            }
        });
        if (existingSku) {
            return res.status(400).json({ success: false, error: 'Item with this SKU or barcode already exists' });
        }
        const item = await db_1.prisma.item.create({
            data: parseResult.data,
            include: { category: true, supplier: true }
        });
        // Auto-initialize stock levels to 0 in all warehouses
        const warehouses = await db_1.prisma.warehouse.findMany();
        await Promise.all(warehouses.map(wh => db_1.prisma.stockLevel.create({
            data: {
                itemId: item.id,
                warehouseId: wh.id,
                quantity: 0,
                reservedQuantity: 0,
                availableQuantity: 0
            }
        })));
        await (0, audit_1.logAudit)(req.user.userId, 'CREATE_ITEM', 'Item', item.id, null, item);
        return res.status(201).json({ success: true, data: item });
    }
    catch (error) {
        console.error('Create item error:', error);
        return res.status(500).json({ success: false, error: 'Failed to create item' });
    }
};
exports.createItem = createItem;
// Update Item
const updateItem = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'AIRPORT_MGR')) {
            return res.status(403).json({ success: false, error: 'Unauthorized to update items' });
        }
        const parseResult = schemas_1.ItemSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
        }
        const item = await db_1.prisma.item.findUnique({ where: { id } });
        if (!item) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }
        const updatedItem = await db_1.prisma.item.update({
            where: { id },
            data: parseResult.data,
            include: { category: true, supplier: true }
        });
        await (0, audit_1.logAudit)(req.user.userId, 'UPDATE_ITEM', 'Item', id, item, updatedItem);
        return res.status(200).json({ success: true, data: updatedItem });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to update item' });
    }
};
exports.updateItem = updateItem;
