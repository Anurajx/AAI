import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

export const ItemSchema = z.object({
  name: z.string().min(2, 'Item name must be at least 2 characters'),
  skuCode: z.string().min(3, 'SKU Code must be at least 3 characters'),
  categoryId: z.string().uuid('Invalid Category ID'),
  unitOfMeasure: z.string().min(1, 'Unit of measure is required'),
  reorderThreshold: z.number().int().nonnegative('Threshold must be positive'),
  reorderQuantity: z.number().int().positive('Reorder quantity must be greater than zero'),
  unitCost: z.number().positive('Unit cost must be greater than zero'),
  supplierId: z.string().uuid('Invalid Supplier ID'),
  barcodeValue: z.string().min(3, 'Barcode is required'),
  imageUrl: z.string().optional(),
});

export const StockAdjustSchema = z.object({
  itemId: z.string().uuid('Invalid Item ID'),
  warehouseId: z.string().uuid('Invalid Warehouse ID'),
  quantity: z.number().int().positive('Quantity must be greater than zero'),
  transactionType: z.enum(['ADJUSTMENT', 'DAMAGED', 'RETURNED', 'IN', 'OUT']),
  reason: z.string().min(3, 'A valid reason is required (at least 3 characters)'),
});

export const StockTransferSchema = z.object({
  itemId: z.string().uuid('Invalid Item ID'),
  sourceWarehouseId: z.string().uuid('Invalid Source Warehouse ID'),
  targetWarehouseId: z.string().uuid('Invalid Target Warehouse ID'),
  quantity: z.number().int().positive('Quantity must be greater than zero'),
});

export const RequisitionSchema = z.object({
  requestingDepartment: z.string().min(2, 'Department name is required'),
  airportId: z.string().uuid('Invalid Airport ID'),
  items: z.array(
    z.object({
      itemId: z.string().uuid('Invalid Item ID'),
      quantityRequested: z.number().int().positive('Quantity must be positive'),
    })
  ).min(1, 'At least one item must be requested'),
});

export const RequisitionApproveSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  comments: z.string().optional(),
});

export const PurchaseOrderSchema = z.object({
  supplierId: z.string().uuid('Invalid Supplier ID'),
  expectedDeliveryDate: z.string().datetime('Invalid expected delivery date format'),
  items: z.array(
    z.object({
      itemId: z.string().uuid('Invalid Item ID'),
      quantityOrdered: z.number().int().positive('Quantity must be positive'),
      unitCost: z.number().positive('Unit cost must be positive'),
    })
  ).min(1, 'At least one item is required'),
});

export const POReceiveSchema = z.object({
  items: z.array(
    z.object({
      itemId: z.string().uuid('Invalid Item ID'),
      quantityReceived: z.number().int().nonnegative('Quantity cannot be negative'),
    })
  ).min(1, 'At least one item is required'),
});
