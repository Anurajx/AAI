"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POReceiveSchema = exports.PurchaseOrderSchema = exports.RequisitionApproveSchema = exports.RequisitionSchema = exports.StockTransferSchema = exports.StockAdjustSchema = exports.ItemSchema = exports.LoginSchema = void 0;
const zod_1 = require("zod");
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters long'),
});
exports.ItemSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Item name must be at least 2 characters'),
    skuCode: zod_1.z.string().min(3, 'SKU Code must be at least 3 characters'),
    categoryId: zod_1.z.string().uuid('Invalid Category ID'),
    unitOfMeasure: zod_1.z.string().min(1, 'Unit of measure is required'),
    reorderThreshold: zod_1.z.number().int().nonnegative('Threshold must be positive'),
    reorderQuantity: zod_1.z.number().int().positive('Reorder quantity must be greater than zero'),
    unitCost: zod_1.z.number().positive('Unit cost must be greater than zero'),
    supplierId: zod_1.z.string().uuid('Invalid Supplier ID'),
    barcodeValue: zod_1.z.string().min(3, 'Barcode is required'),
    imageUrl: zod_1.z.string().optional(),
});
exports.StockAdjustSchema = zod_1.z.object({
    itemId: zod_1.z.string().uuid('Invalid Item ID'),
    warehouseId: zod_1.z.string().uuid('Invalid Warehouse ID'),
    quantity: zod_1.z.number().int().positive('Quantity must be greater than zero'),
    transactionType: zod_1.z.enum(['ADJUSTMENT', 'DAMAGED', 'RETURNED', 'IN', 'OUT']),
    reason: zod_1.z.string().min(3, 'A valid reason is required (at least 3 characters)'),
});
exports.StockTransferSchema = zod_1.z.object({
    itemId: zod_1.z.string().uuid('Invalid Item ID'),
    sourceWarehouseId: zod_1.z.string().uuid('Invalid Source Warehouse ID'),
    targetWarehouseId: zod_1.z.string().uuid('Invalid Target Warehouse ID'),
    quantity: zod_1.z.number().int().positive('Quantity must be greater than zero'),
});
exports.RequisitionSchema = zod_1.z.object({
    requestingDepartment: zod_1.z.string().min(2, 'Department name is required'),
    airportId: zod_1.z.string().uuid('Invalid Airport ID'),
    items: zod_1.z.array(zod_1.z.object({
        itemId: zod_1.z.string().uuid('Invalid Item ID'),
        quantityRequested: zod_1.z.number().int().positive('Quantity must be positive'),
    })).min(1, 'At least one item must be requested'),
});
exports.RequisitionApproveSchema = zod_1.z.object({
    status: zod_1.z.enum(['APPROVED', 'REJECTED']),
    comments: zod_1.z.string().optional(),
});
exports.PurchaseOrderSchema = zod_1.z.object({
    supplierId: zod_1.z.string().uuid('Invalid Supplier ID'),
    expectedDeliveryDate: zod_1.z.string().datetime('Invalid expected delivery date format'),
    items: zod_1.z.array(zod_1.z.object({
        itemId: zod_1.z.string().uuid('Invalid Item ID'),
        quantityOrdered: zod_1.z.number().int().positive('Quantity must be positive'),
        unitCost: zod_1.z.number().positive('Unit cost must be positive'),
    })).min(1, 'At least one item is required'),
});
exports.POReceiveSchema = zod_1.z.object({
    items: zod_1.z.array(zod_1.z.object({
        itemId: zod_1.z.string().uuid('Invalid Item ID'),
        quantityReceived: zod_1.z.number().int().nonnegative('Quantity cannot be negative'),
    })).min(1, 'At least one item is required'),
});
