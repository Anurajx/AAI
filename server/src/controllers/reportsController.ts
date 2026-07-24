import { Response } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';
import { getAirportScope } from '../utils/scope';
import PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';

// Stock Valuation Report (by Category, Warehouse, Airport)
export const getValuationReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = getAirportScope(req.user);

    // Fetch stock levels filtered by scope
    const stockLevels = await prisma.stockLevel.findMany({
      where: scope.airportId ? { warehouse: { airportId: scope.airportId } } : {},
      include: {
        item: { include: { category: true } },
        warehouse: { include: { airport: true } }
      }
    });

    // Aggregate values
    let totalItemsCount = 0;
    let totalValuation = 0;
    const categoryBreakdown: { [key: string]: { name: string; value: number; count: number } } = {};
    const warehouseBreakdown: { [key: string]: { name: string; airport: string; value: number } } = {};

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
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to generate valuation report' });
  }
};

// Fast-Moving vs Slow-Moving / Dead Stock Report
export const getVelocityReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = getAirportScope(req.user);
    
    // Check stock movements in the last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const transactions = await prisma.stockTransaction.findMany({
      where: {
        transactionType: { in: ['OUT', 'TRANSFER'] },
        timestamp: { gte: ninetyDaysAgo },
        warehouse: scope.airportId ? { airportId: scope.airportId } : {}
      },
      include: { item: { include: { category: true } } }
    });

    // Sum quantities issued per item
    const velocityMap = new Map<string, { itemId: string; name: string; skuCode: string; categoryName: string; totalIssued: number }>();

    // Initialize all items first (to show 0 movement/dead stock)
    const allItems = await prisma.item.findMany({
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
  } catch (error) {
    console.error('Velocity report error:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate velocity report' });
  }
};

// Reorder Report (Items due for restock)
export const getReorderReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = getAirportScope(req.user);

    // Fetch all stock levels scoped to the user
    const stockLevels = await prisma.stockLevel.findMany({
      where: scope.airportId ? { warehouse: { airportId: scope.airportId } } : {},
      include: {
        item: { include: { category: true, supplier: true } },
        warehouse: { include: { airport: true } }
      }
    });

    // Group by item to sum total quantity across all warehouses in scope
    const itemStockMap = new Map<string, { item: any; quantity: number; warehouses: string[] }>();

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
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to generate reorder report' });
  }
};

// PDF EXPORT HANDLER
export const exportPDF = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = getAirportScope(req.user);

    const stockLevels = await prisma.stockLevel.findMany({
      where: scope.airportId ? { warehouse: { airportId: scope.airportId } } : {},
      include: {
        item: { include: { category: true } },
        warehouse: { include: { airport: true } }
      }
    });

    const doc = new PDFDocument({ margin: 50 });
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
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to export PDF' });
  }
};

// EXCEL EXPORT HANDLER
export const exportExcel = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = getAirportScope(req.user);

    const stockLevels = await prisma.stockLevel.findMany({
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
  } catch (error) {
    console.error('Excel export error:', error);
    return res.status(500).json({ success: false, error: 'Failed to export Excel' });
  }
};
