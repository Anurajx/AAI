import { Response } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';
import { RequisitionSchema, RequisitionApproveSchema, PurchaseOrderSchema, POReceiveSchema } from '../validation/schemas';
import { getAirportScope, checkAirportAccess } from '../utils/scope';
import { logAudit } from '../utils/audit';
import { createNotification, notifyUsersByRole } from '../utils/notifications';
import { POStatus, ReqStatus, TransactionType } from '@prisma/client';

// ==========================================
// REQUISITIONS (INTERNAL DEMAND)
// ==========================================

export const createRequisition = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const parseResult = RequisitionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
    }

    const { requestingDepartment, airportId, items } = parseResult.data;

    // Check airport scope
    if (req.user.role !== 'SUPER_ADMIN' && req.user.airportId !== airportId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cannot create requisition for another airport' });
    }

    const count = await prisma.requisition.count();
    const reqNumber = `REQ-2026-${(count + 1).toString().padStart(4, '0')}`;

    const result = await prisma.$transaction(async (tx) => {
      const requisition = await tx.requisition.create({
        data: {
          reqNumber,
          requestingDepartment,
          airportId,
          requestedByUserId: req.user!.userId,
          status: ReqStatus.PENDING
        }
      });

      const reqItems = await Promise.all(
        items.map(item =>
          tx.requisitionItem.create({
            data: {
              requisitionId: requisition.id,
              itemId: item.itemId,
              quantityRequested: item.quantityRequested
            }
          })
        )
      );

      return { requisition, reqItems };
    });

    // Notify Airport Managers
    const message = `New requisition ${reqNumber} submitted by ${req.user.employeeId} for department ${requestingDepartment}.`;
    await notifyUsersByRole('AIRPORT_MGR', 'Requisition Pending Approval', message, 'REQUISITION_APPROVAL', airportId);
    await notifyUsersByRole('SUPER_ADMIN', 'Requisition Pending Approval', message, 'REQUISITION_APPROVAL');

    await logAudit(req.user.userId, 'CREATE_REQUISITION', 'Requisition', result.requisition.id, null, result);

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Requisition creation error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create requisition' });
  }
};

export const getRequisitions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = getAirportScope(req.user);
    const where: any = {};

    if (scope.airportId) {
      where.airportId = scope.airportId;
    }

    const requisitions = await prisma.requisition.findMany({
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
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch requisitions' });
  }
};

export const approveRequisition = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'AIRPORT_MGR')) {
      return res.status(403).json({ success: false, error: 'Unauthorized to approve requisitions' });
    }

    const parseResult = RequisitionApproveSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
    }

    const { status, comments } = parseResult.data;

    const requisition = await prisma.requisition.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!requisition) {
      return res.status(404).json({ success: false, error: 'Requisition not found' });
    }

    if (requisition.status !== ReqStatus.PENDING) {
      return res.status(400).json({ success: false, error: 'Requisition has already been processed' });
    }

    if (req.user.role !== 'SUPER_ADMIN' && req.user.airportId !== requisition.airportId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Airport scope mismatch' });
    }

    const result = await prisma.$transaction(async (tx) => {
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
          status: status as ReqStatus,
          approvedByUserId: req.user!.userId,
          comments
        },
        include: { requestedByUser: true }
      });

      return updatedReq;
    });

    // Notify requester
    await createNotification(
      requisition.requestedByUserId,
      `Requisition ${requisition.reqNumber} ${status}`,
      `Your requisition request was ${status.toLowerCase()} by regional manager. Comments: ${comments || 'None'}`,
      'REQUISITION'
    );

    await logAudit(req.user.userId, `REQUISITION_${status}`, 'Requisition', id, requisition, result);

    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message || 'Failed to approve requisition' });
  }
};

export const fulfillRequisition = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'AIRPORT_MGR' && req.user.role !== 'STAFF')) {
      return res.status(403).json({ success: false, error: 'Unauthorized to dispatch requisitions' });
    }

    const requisition = await prisma.requisition.findUnique({
      where: { id },
      include: { items: { include: { item: true } } }
    });

    if (!requisition) {
      return res.status(404).json({ success: false, error: 'Requisition not found' });
    }

    if (requisition.status !== ReqStatus.APPROVED) {
      return res.status(400).json({ success: false, error: 'Requisition must be APPROVED before dispatch' });
    }

    if (req.user.role !== 'SUPER_ADMIN' && req.user.airportId !== requisition.airportId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Airport scope mismatch' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findFirst({
        where: { airportId: requisition.airportId }
      });

      if (!warehouse) throw new Error('Warehouse not found');

      for (const reqItem of requisition.items) {
        const stock = await tx.stockLevel.findUnique({
          where: { itemId_warehouseId: { itemId: reqItem.itemId, warehouseId: warehouse.id } }
        });

        if (!stock) throw new Error('Stock level record not found');

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
            transactionType: TransactionType.OUT,
            itemId: reqItem.itemId,
            warehouseId: warehouse.id,
            quantity: reqItem.quantityRequested,
            referenceNumber: requisition.reqNumber,
            performedByUserId: req.user!.userId,
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
        data: { status: ReqStatus.FULFILLED }
      });

      return fulfilledReq;
    });

    await logAudit(req.user.userId, 'FULFILL_REQUISITION', 'Requisition', id, requisition, result);

    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message || 'Failed to fulfill requisition' });
  }
};

// ==========================================
// PURCHASE ORDERS (PROCUREMENT)
// ==========================================

export const createPO = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'AIRPORT_MGR')) {
      return res.status(403).json({ success: false, error: 'Unauthorized to create Purchase Orders' });
    }

    const parseResult = PurchaseOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
    }

    const { supplierId, expectedDeliveryDate, items } = parseResult.data;

    const count = await prisma.purchaseOrder.count();
    const poNumber = `PO-2026-${(count + 1).toString().padStart(4, '0')}`;
    const totalCost = items.reduce((sum, item) => sum + (item.quantityOrdered * item.unitCost), 0);

    const result = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId,
          status: POStatus.DRAFT,
          totalCost,
          expectedDeliveryDate: new Date(expectedDeliveryDate),
          createdByUserId: req.user!.userId
        }
      });

      const poItems = await Promise.all(
        items.map(item =>
          tx.purchaseOrderItem.create({
            data: {
              purchaseOrderId: po.id,
              itemId: item.itemId,
              quantityOrdered: item.quantityOrdered,
              unitCost: item.unitCost
            }
          })
        )
      );

      return { po, poItems };
    });

    // Notify Super Admin if created by Manager
    if (req.user.role === 'AIRPORT_MGR') {
      await notifyUsersByRole(
        'SUPER_ADMIN',
        'Purchase Order Pending Approval',
        `Regional Manager submitted PO ${poNumber} for approval. Total Value: INR ${totalCost.toLocaleString()}`,
        'PO_STATUS'
      );
    }

    await logAudit(req.user.userId, 'CREATE_PO', 'PurchaseOrder', result.po.id, null, result);

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('PO Creation error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create Purchase Order' });
  }
};

export const getPOs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = getAirportScope(req.user);
    const where: any = {};

    // Scope POs to the user's airport based on the creator's assigned airport
    if (scope.airportId) {
      where.createdByUser = { airportId: scope.airportId };
    }

    const pos = await prisma.purchaseOrder.findMany({
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
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch Purchase Orders' });
  }
};

export const approvePO = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Only Super Admins can approve procurement Purchase Orders' });
    }

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) return res.status(404).json({ success: false, error: 'Purchase Order not found' });
    if (po.status !== POStatus.DRAFT && po.status !== POStatus.PENDING_APPROVAL) {
      return res.status(400).json({ success: false, error: 'Purchase Order is not in draft or pending state' });
    }

    const updatedPo = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: POStatus.APPROVED,
        approvedByUserId: req.user.userId
      }
    });

    // Notify regional manager creator
    await createNotification(
      po.createdByUserId,
      `PO ${po.poNumber} Approved`,
      `Your Purchase Order was approved. You can now transmit it to the vendor.`,
      'PO_STATUS'
    );

    await logAudit(req.user.userId, 'APPROVE_PO', 'PurchaseOrder', id, po, updatedPo);

    return res.status(200).json({ success: true, data: updatedPo });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to approve Purchase Order' });
  }
};

export const orderPO = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'AIRPORT_MGR')) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) return res.status(404).json({ success: false, error: 'PO not found' });
    if (po.status !== POStatus.APPROVED) {
      return res.status(400).json({ success: false, error: 'PO must be approved before ordering' });
    }

    const updatedPo = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: POStatus.ORDERED }
    });

    await logAudit(req.user.userId, 'ORDER_PO', 'PurchaseOrder', id, po, updatedPo);

    return res.status(200).json({ success: true, data: updatedPo });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update PO status' });
  }
};

export const receivePO = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { warehouseId } = req.body; // Warehouse where goods will be received
    if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'AIRPORT_MGR' && req.user.role !== 'STAFF')) {
      return res.status(403).json({ success: false, error: 'Unauthorized to receive shipments' });
    }

    const parseResult = POReceiveSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
    }

    if (!warehouseId) {
      return res.status(400).json({ success: false, error: 'warehouseId is required' });
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!po) return res.status(404).json({ success: false, error: 'PO not found' });
    if (po.status !== POStatus.ORDERED && po.status !== POStatus.PARTIALLY_RECEIVED) {
      return res.status(400).json({ success: false, error: 'PO is not in ORDERED or PARTIALLY_RECEIVED state' });
    }

    const wh = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!wh) return res.status(404).json({ success: false, error: 'Selected receiving warehouse not found' });

    if (req.user.role !== 'SUPER_ADMIN' && req.user.airportId !== wh.airportId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Warehouse belongs to another airport' });
    }

    const { items: receivedItems } = parseResult.data;

    const result = await prisma.$transaction(async (tx) => {
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
              transactionType: TransactionType.IN,
              itemId: reqItem.itemId,
              warehouseId,
              quantity: addQty,
              referenceNumber: po.poNumber,
              performedByUserId: req.user!.userId,
              reason: 'Procurement PO Delivery Inbound'
            }
          });
        }
      }

      // Update PO Status
      const finalStatus = allReceived ? POStatus.RECEIVED : POStatus.PARTIALLY_RECEIVED;
      const updatedPo = await tx.purchaseOrder.update({
        where: { id },
        data: { status: finalStatus }
      });

      return updatedPo;
    });

    await logAudit(req.user.userId, 'RECEIVE_PO_GOODS', 'PurchaseOrder', id, po, result);

    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message || 'Failed to process PO receipt' });
  }
};

export const suggestPO = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = getAirportScope(req.user);

    // Fetch all stock levels filterable by user scope
    const allStock = await prisma.stockLevel.findMany({
      where: scope.airportId ? { warehouse: { airportId: scope.airportId } } : {},
      include: { item: { include: { supplier: true } }, warehouse: true }
    });

    // Group items and aggregate stock levels
    const itemMap = new Map<string, { item: any, totalQty: number, warehouses: any[] }>();

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
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch reorder suggestions' });
  }
};
