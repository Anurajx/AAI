"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportExcel = exports.exportPDF = exports.getReorderReport = exports.getVelocityReport = exports.getValuationReport = void 0;
const db_1 = require("../db");
const scope_1 = require("../utils/scope");
const pdfkit_1 = __importDefault(require("pdfkit"));
const ExcelJS = __importStar(require("exceljs"));
// Stock Valuation Report (by Category, Warehouse, Airport)
const getValuationReport = async (req, res) => {
    try {
        const scope = (0, scope_1.getAirportScope)(req.user);
        // Fetch stock levels filtered by scope
        const stockLevels = await db_1.prisma.stockLevel.findMany({
            where: scope.airportId ? { warehouse: { airportId: scope.airportId } } : {},
            include: {
                item: { include: { category: true } },
                warehouse: { include: { airport: true } }
            }
        });
        // Aggregate values
        let totalItemsCount = 0;
        let totalValuation = 0;
        const categoryBreakdown = {};
        const warehouseBreakdown = {};
        for (const sl of stockLevels) {
            const itemValuation = sl.quantity * sl.item.unitCost;
            totalItemsCount += sl.quantity;
            totalValuation += itemValuation;
            // Category breakdown
            const catName = sl.item.category.name;
            if (!categoryBreakdown[catName]) {
                categoryBreakdown[catName] = { name: catName, value: 0, count: 0 };
            }
            categoryBreakdown[catName].value += itemValuation;
            categoryBreakdown[catName].count += sl.quantity;
            // Warehouse breakdown
            const whName = sl.warehouse.name;
            if (!warehouseBreakdown[whName]) {
                warehouseBreakdown[whName] = { name: whName, airport: sl.warehouse.airport.code, value: 0 };
            }
            warehouseBreakdown[whName].value += itemValuation;
        }
        return res.status(200).json({
            success: true,
            data: {
                totalValuation,
                totalItemsCount,
                categoryValuation: Object.values(categoryBreakdown),
                warehouseValuation: Object.values(warehouseBreakdown),
                stockLevels: stockLevels.map(sl => ({
                    itemName: sl.item.name,
                    skuCode: sl.item.skuCode,
                    categoryName: sl.item.category.name,
                    warehouseName: sl.warehouse.name,
                    airportCode: sl.warehouse.airport.code,
                    quantity: sl.quantity,
                    unitCost: sl.item.unitCost,
                    totalValue: sl.quantity * sl.item.unitCost
                }))
            }
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to generate valuation report' });
    }
};
exports.getValuationReport = getValuationReport;
// Fast-Moving vs Slow-Moving / Dead Stock Report
const getVelocityReport = async (req, res) => {
    try {
        const scope = (0, scope_1.getAirportScope)(req.user);
        // Check stock movements in the last 90 days
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const transactions = await db_1.prisma.stockTransaction.findMany({
            where: {
                transactionType: { in: ['OUT', 'TRANSFER'] },
                timestamp: { gte: ninetyDaysAgo },
                warehouse: scope.airportId ? { airportId: scope.airportId } : {}
            },
            include: { item: { include: { category: true } } }
        });
        // Sum quantities issued per item
        const velocityMap = new Map();
        // Initialize all items first (to show 0 movement/dead stock)
        const allItems = await db_1.prisma.item.findMany({
            include: { category: true }
        });
        for (const item of allItems) {
            velocityMap.set(item.id, {
                itemId: item.id,
                name: item.name,
                skuCode: item.skuCode,
                categoryName: item.category.name,
                totalIssued: 0
            });
        }
        // Add up transaction quantities
        for (const txn of transactions) {
            const entry = velocityMap.get(txn.itemId);
            if (entry) {
                entry.totalIssued += txn.quantity;
            }
        }
        const velocityList = Array.from(velocityMap.values());
        velocityList.sort((a, b) => b.totalIssued - a.totalIssued);
        // Fast-moving: items with highest outbound volume
        const fastMoving = velocityList.slice(0, 8);
        // Slow-moving / Dead stock: items with lowest or 0 outbound volume
        const slowMoving = velocityList.filter(x => x.totalIssued <= 5).slice(0, 10);
        return res.status(200).json({
            success: true,
            data: {
                fastMoving,
                slowMoving
            }
        });
    }
    catch (error) {
        console.error('Velocity report error:', error);
        return res.status(500).json({ success: false, error: 'Failed to generate velocity report' });
    }
};
exports.getVelocityReport = getVelocityReport;
// Reorder Report (Items due for restock)
const getReorderReport = async (req, res) => {
    try {
        const scope = (0, scope_1.getAirportScope)(req.user);
        // Fetch all stock levels scoped to the user
        const stockLevels = await db_1.prisma.stockLevel.findMany({
            where: scope.airportId ? { warehouse: { airportId: scope.airportId } } : {},
            include: {
                item: { include: { category: true, supplier: true } },
                warehouse: { include: { airport: true } }
            }
        });
        // Group by item to sum total quantity across all warehouses in scope
        const itemStockMap = new Map();
        for (const sl of stockLevels) {
            const entry = itemStockMap.get(sl.itemId) || { item: sl.item, quantity: 0, warehouses: [] };
            entry.quantity += sl.quantity;
            entry.warehouses.push(`${sl.warehouse.name} (${sl.quantity})`);
            itemStockMap.set(sl.itemId, entry);
        }
        const reorderRequired = Array.from(itemStockMap.values())
            .filter(entry => entry.quantity <= entry.item.reorderThreshold)
            .map(entry => ({
            itemId: entry.item.id,
            name: entry.item.name,
            skuCode: entry.item.skuCode,
            category: entry.item.category.name,
            currentStock: entry.quantity,
            reorderThreshold: entry.item.reorderThreshold,
            suggestedOrderQty: entry.item.reorderQuantity,
            unitCost: entry.item.unitCost,
            totalReorderCost: entry.item.reorderQuantity * entry.item.unitCost,
            supplierName: entry.item.supplier.name,
            warehouses: entry.warehouses
        }));
        return res.status(200).json({ success: true, data: reorderRequired });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to generate reorder report' });
    }
};
exports.getReorderReport = getReorderReport;
// PDF EXPORT HANDLER
const exportPDF = async (req, res) => {
    try {
        const scope = (0, scope_1.getAirportScope)(req.user);
        const stockLevels = await db_1.prisma.stockLevel.findMany({
            where: scope.airportId ? { warehouse: { airportId: scope.airportId } } : {},
            include: {
                item: { include: { category: true } },
                warehouse: { include: { airport: true } }
            }
        });
        const doc = new pdfkit_1.default({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=AeroStock_Valuation_Report.pdf');
        doc.pipe(res);
        // Header Title
        doc.fillColor('#0a0f1d').fontSize(20).text('AIRPORT AUTHORITY OF INDIA', { align: 'center' });
        doc.fontSize(14).text('AeroStock - Inventory Valuation & Asset Audit Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Generated On: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, { align: 'right' });
        doc.text(`Scope: ${scope.airportId ? `Airport Assigned: ${scope.airportId}` : 'Global (Super Admin / Auditor Scope)'}`, { align: 'right' });
        doc.moveDown();
        // Table Header
        doc.rect(50, 150, 512, 20).fill('#1e293b');
        doc.fillColor('#ffffff').fontSize(9);
        doc.text('SKU', 60, 156, { width: 90 });
        doc.text('Item Name', 160, 156, { width: 150 });
        doc.text('Warehouse', 320, 156, { width: 100 });
        doc.text('Qty', 430, 156, { width: 30, align: 'right' });
        doc.text('Unit Cost', 470, 156, { width: 40, align: 'right' });
        doc.text('Total Value', 510, 156, { width: 50, align: 'right' });
        doc.fillColor('#333333');
        let y = 175;
        let totalVal = 0;
        for (const sl of stockLevels) {
            if (y > 700) {
                doc.addPage();
                y = 50;
                doc.rect(50, y, 512, 20).fill('#1e293b');
                doc.fillColor('#ffffff');
                doc.text('SKU', 60, y + 6, { width: 90 });
                doc.text('Item Name', 160, y + 6, { width: 150 });
                doc.text('Warehouse', 320, y + 6, { width: 100 });
                doc.text('Qty', 430, y + 6, { width: 30, align: 'right' });
                doc.text('Unit Cost', 470, y + 6, { width: 40, align: 'right' });
                doc.text('Total Value', 510, y + 6, { width: 50, align: 'right' });
                y += 25;
            }
            const itemTotal = sl.quantity * sl.item.unitCost;
            totalVal += itemTotal;
            doc.fillColor('#333333');
            doc.text(sl.item.skuCode, 60, y, { width: 90, ellipsis: true });
            doc.text(sl.item.name, 160, y, { width: 150, height: 12, ellipsis: true });
            doc.text(`${sl.warehouse.name} (${sl.warehouse.airport.code})`, 320, y, { width: 100, ellipsis: true });
            doc.text(sl.quantity.toString(), 430, y, { width: 30, align: 'right' });
            doc.text(`₹${sl.item.unitCost.toFixed(0)}`, 470, y, { width: 40, align: 'right' });
            doc.text(`₹${itemTotal.toFixed(0)}`, 510, y, { width: 50, align: 'right' });
            y += 18;
        }
        doc.moveDown();
        doc.lineWidth(1);
        doc.lineCap('butt').moveTo(50, y).lineTo(562, y).stroke('#dddddd');
        y += 10;
        doc.fillColor('#0a0f1d').fontSize(11).text(`Grand Total Valuation: ₹${totalVal.toLocaleString()}`, 350, y, { align: 'right' });
        doc.end();
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to export PDF' });
    }
};
exports.exportPDF = exportPDF;
// EXCEL EXPORT HANDLER
const exportExcel = async (req, res) => {
    try {
        const scope = (0, scope_1.getAirportScope)(req.user);
        const stockLevels = await db_1.prisma.stockLevel.findMany({
            where: scope.airportId ? { warehouse: { airportId: scope.airportId } } : {},
            include: {
                item: { include: { category: true } },
                warehouse: { include: { airport: true } }
            }
        });
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Valuation Report');
        worksheet.columns = [
            { header: 'SKU Code', key: 'skuCode', width: 20 },
            { header: 'Item Name', key: 'name', width: 35 },
            { header: 'Category', key: 'category', width: 20 },
            { header: 'Warehouse', key: 'warehouse', width: 25 },
            { header: 'Airport', key: 'airport', width: 10 },
            { header: 'Current Quantity', key: 'qty', width: 15 },
            { header: 'Unit Cost (INR)', key: 'cost', width: 15 },
            { header: 'Total Valuation (INR)', key: 'totalValue', width: 20 }
        ];
        // Format Header Row
        worksheet.getRow(1).font = { name: 'Arial', family: 4, size: 11, bold: true, color: { argb: 'FFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F172A' } };
        let grandTotal = 0;
        for (const sl of stockLevels) {
            const itemTotal = sl.quantity * sl.item.unitCost;
            grandTotal += itemTotal;
            worksheet.addRow({
                skuCode: sl.item.skuCode,
                name: sl.item.name,
                category: sl.item.category.name,
                warehouse: sl.warehouse.name,
                airport: sl.warehouse.airport.code,
                qty: sl.quantity,
                cost: sl.item.unitCost,
                totalValue: itemTotal
            });
        }
        // Add Grand Total Row
        worksheet.addRow({});
        const totalRow = worksheet.addRow({
            skuCode: 'GRAND TOTAL',
            totalValue: grandTotal
        });
        totalRow.font = { bold: true };
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=AeroStock_Valuation_Report.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    }
    catch (error) {
        console.error('Excel export error:', error);
        return res.status(500).json({ success: false, error: 'Failed to export Excel' });
    }
};
exports.exportExcel = exportExcel;
