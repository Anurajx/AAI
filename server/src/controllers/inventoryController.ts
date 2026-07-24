import { Response } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';
import { ItemSchema } from '../validation/schemas';
import { getAirportScope } from '../utils/scope';
import { logAudit } from '../utils/audit';

// Airports
export const getAirports = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = getAirportScope(req.user);
    const filter = scope.airportId ? { id: scope.airportId } : {};

    const airports = await prisma.airport.findMany({
      where: filter,
      include: {
        _count: {
          select: { warehouses: true, users: true }
        }
      }
    });
    return res.status(200).json({ success: true, data: airports });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch airports' });
  }
};

// Warehouses
export const getWarehouses = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = getAirportScope(req.user);
    const { airportId } = req.query;

    const filter: any = {};
    if (scope.airportId) {
      filter.airportId = scope.airportId;
    } else if (airportId) {
      filter.airportId = String(airportId);
    }

    const warehouses = await prisma.warehouse.findMany({
      where: filter,
      include: { airport: true }
    });
    return res.status(200).json({ success: true, data: warehouses });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch warehouses' });
  }
};

// Categories
export const getCategories = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: { select: { items: true } }
      }
    });
    return res.status(200).json({ success: true, data: categories });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
};

// Suppliers
export const getSuppliers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: 'asc' }
    });
    return res.status(200).json({ success: true, data: suppliers });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch suppliers' });
  }
};

// Items (SKUs) - Search, Filter, Page
export const getItems = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = getAirportScope(req.user);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const { categoryId, search, status, warehouseId, airportId } = req.query;

    // Filter build
    const where: any = {};

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
    const stockConditions: any = {};
    if (scope.airportId) {
      stockConditions.warehouse = { airportId: scope.airportId };
    } else if (airportId) {
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
    const [items, total] = await prisma.$transaction([
      prisma.item.findMany({
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
      prisma.item.count({ where })
    ]);

    // Format stock status (In stock, low stock, out of stock) in JSON response
    const formattedItems = items.map(item => {
      const totalQty = item.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0);
      let stockStatus = 'IN_STOCK';
      if (totalQty === 0) {
        stockStatus = 'OUT_OF_STOCK';
      } else if (totalQty <= item.reorderThreshold) {
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
  } catch (error) {
    console.error('Failed to fetch items:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch items' });
  }
};

// Item Detail
export const getItemDetail = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const scope = getAirportScope(req.user);

    const item = await prisma.item.findUnique({
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
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch item details' });
  }
};

// Create Item
export const createItem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'AIRPORT_MGR')) {
      return res.status(403).json({ success: false, error: 'Unauthorized to create items' });
    }

    const parseResult = ItemSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
    }

    const existingSku = await prisma.item.findFirst({
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

    const item = await prisma.item.create({
      data: parseResult.data,
      include: { category: true, supplier: true }
    });

    // Auto-initialize stock levels to 0 in all warehouses
    const warehouses = await prisma.warehouse.findMany();
    await Promise.all(
      warehouses.map(wh =>
        prisma.stockLevel.create({
          data: {
            itemId: item.id,
            warehouseId: wh.id,
            quantity: 0,
            reservedQuantity: 0,
            availableQuantity: 0
          }
        })
      )
    );

    await logAudit(req.user.userId, 'CREATE_ITEM', 'Item', item.id, null, item);

    return res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('Create item error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create item' });
  }
};

// Update Item
export const updateItem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'AIRPORT_MGR')) {
      return res.status(403).json({ success: false, error: 'Unauthorized to update items' });
    }

    const parseResult = ItemSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
    }

    const item = await prisma.item.findUnique({ where: { id } });
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    const updatedItem = await prisma.item.update({
      where: { id },
      data: parseResult.data,
      include: { category: true, supplier: true }
    });

    await logAudit(req.user.userId, 'UPDATE_ITEM', 'Item', id, item, updatedItem);

    return res.status(200).json({ success: true, data: updatedItem });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update item' });
  }
};
