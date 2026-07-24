import { Response } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';
import { StockAdjustSchema, StockTransferSchema } from '../validation/schemas';
import { getAirportScope } from '../utils/scope';
import { logAudit } from '../utils/audit';
import { createNotification, notifyUsersByRole } from '../utils/notifications';
import { TransactionType } from '@prisma/client';

// Get current stock levels (filtered and scoped)
export const getStockLevels = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = getAirportScope(req.user);
    const { itemId, warehouseId } = req.query;

    const where: any = {};
    if (itemId) {
      where.itemId = String(itemId);
    }
    
    const warehouseFilter: any = {};
    if (scope.airportId) {
      warehouseFilter.airportId = scope.airportId;
    }
    if (warehouseId) {
      warehouseFilter.id = String(warehouseId);
    }

    if (Object.keys(warehouseFilter).length > 0) {
      where.warehouse = warehouseFilter;
    }

    const stockLevels = await prisma.stockLevel.findMany({
      where,
      include: {
        item: { include: { category: true } },
        warehouse: { include: { airport: true } }
      },
      orderBy: { item: { name: 'asc' } }
    });

    return res.status(200).json({ success: true, data: stockLevels });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch stock levels' });
  }
};

// Adjust stock levels (damages, recount, returns)
export const adjustStock = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'AIRPORT_MGR' && req.user.role !== 'STAFF')) {
      return res.status(403).json({ success: false, error: 'Unauthorized to adjust stock levels' });
    }

    const parseResult = StockAdjustSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
    }

    const { itemId, warehouseId, quantity, transactionType, reason } = parseResult.data;

    // Verify warehouse airport scope
    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) {
      return res.status(404).json({ success: false, error: 'Warehouse not found' });
    }

    if (req.user.role !== 'SUPER_ADMIN' && req.user.airportId !== warehouse.airportId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Warehouse belongs to another airport' });
    }

    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    // Begin database transaction
    const result = await prisma.$transaction(async (tx) => {
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
      } else if (isSubtraction || (transactionType === 'ADJUSTMENT' && quantity < 0)) {
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
          transactionType: transactionType as TransactionType,
          itemId,
          warehouseId,
          quantity: Math.abs(quantity),
          performedByUserId: req.user!.userId,
          reason,
          referenceNumber: `ADJ-${Date.now().toString().slice(-6)}`
        }
      });

      // Log to Audit trail
      await logAudit(req.user!.userId, 'STOCK_ADJUSTMENT', 'StockLevel', stockLevel.id, originalStockLevel, updatedStockLevel);

      return { updatedStockLevel, transaction };
    });

    // Check low stock and trigger alerts
    if (result.updatedStockLevel.quantity <= item.reorderThreshold) {
      const message = `Item "${item.name}" (${item.skuCode}) at ${result.updatedStockLevel.warehouse.name} is low on stock (${result.updatedStockLevel.quantity} units left).`;
      await notifyUsersByRole('AIRPORT_MGR', 'Low Stock Warning', message, 'LOW_STOCK', warehouse.airportId);
      await notifyUsersByRole('SUPER_ADMIN', 'Low Stock Warning', message, 'LOW_STOCK');
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message || 'Failed to adjust stock' });
  }
};

// Transfer stock between warehouses (at same airport or across airports)
export const transferStock = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'AIRPORT_MGR' && req.user.role !== 'STAFF')) {
      return res.status(403).json({ success: false, error: 'Unauthorized to transfer stock' });
    }

    const parseResult = StockTransferSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
    }

    const { itemId, sourceWarehouseId, targetWarehouseId, quantity } = parseResult.data;

    if (sourceWarehouseId === targetWarehouseId) {
      return res.status(400).json({ success: false, error: 'Source and target warehouses must be different' });
    }

    // Verify source warehouse details
    const sourceWh = await prisma.warehouse.findUnique({ where: { id: sourceWarehouseId } });
    if (!sourceWh) {
      return res.status(404).json({ success: false, error: 'Source warehouse not found' });
    }

    if (req.user.role !== 'SUPER_ADMIN' && req.user.airportId !== sourceWh.airportId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Source warehouse belongs to another airport' });
    }

    const targetWh = await prisma.warehouse.findUnique({ where: { id: targetWarehouseId } });
    if (!targetWh) {
      return res.status(404).json({ success: false, error: 'Target warehouse not found' });
    }

    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    // Transaction execution
    const result = await prisma.$transaction(async (tx) => {
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
          transactionType: TransactionType.TRANSFER,
          itemId,
          warehouseId: sourceWarehouseId,
          targetWarehouseId: targetWarehouseId,
          quantity,
          performedByUserId: req.user!.userId,
          reason: `Inter-warehouse transfer from ${sourceWh.name} to ${targetWh.name}`,
          referenceNumber: `TRF-${Date.now().toString().slice(-6)}`
        }
      });

      await logAudit(req.user!.userId, 'STOCK_TRANSFER', 'StockLevel', sourceStock.id, sourceStock, updatedSource);
      await logAudit(req.user!.userId, 'STOCK_TRANSFER', 'StockLevel', targetStock.id, targetStock, updatedTarget);

      return { updatedSource, updatedTarget, transaction };
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message || 'Failed to complete transfer' });
  }
};

// Retrieve historical stock movements (transactions log)
export const getTransactions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = getAirportScope(req.user);
    const { itemId, warehouseId, type } = req.query;

    const where: any = {};

    if (itemId) {
      where.itemId = String(itemId);
    }

    if (type) {
      where.transactionType = type as TransactionType;
    }

    // Scoped warehouse filter
    const warehouseFilter: any = {};
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

    const transactions = await prisma.stockTransaction.findMany({
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
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch transactions history' });
  }
};
