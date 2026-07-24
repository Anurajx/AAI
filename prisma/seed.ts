import { PrismaClient, Role, TransactionType, POStatus, ReqStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing database...');
  // Deleting records in order of dependency to prevent foreign key constraint issues
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.maintenanceRecord.deleteMany();
  await prisma.stockTransaction.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.requisitionItem.deleteMany();
  await prisma.requisition.deleteMany();
  await prisma.item.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.category.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.user.deleteMany();
  await prisma.airport.deleteMany();

  console.log('Seeding Airports...');
  const delhi = await prisma.airport.create({
    data: { code: 'DEL', name: 'Indira Gandhi International Airport', city: 'New Delhi', region: 'Northern' },
  });
  const mumbai = await prisma.airport.create({
    data: { code: 'BOM', name: 'Chhatrapati Shivaji Maharaj International Airport', city: 'Mumbai', region: 'Western' },
  });
  const bengaluru = await prisma.airport.create({
    data: { code: 'BLR', name: 'Kempegowda International Airport', city: 'Bengaluru', region: 'Southern' },
  });

  console.log('Seeding Warehouses...');
  const delWhMain = await prisma.warehouse.create({
    data: { name: 'Terminal 3 Main Warehouse', description: 'Main spares storage for Terminal 3 operations', airportId: delhi.id },
  });
  const delWhCns = await prisma.warehouse.create({
    data: { name: 'CNS Electronics Spares Store', description: 'Communication, Navigation & Surveillance equipment store', airportId: delhi.id },
  });
  const bomWhAirside = await prisma.warehouse.create({
    data: { name: 'Terminal 2 Airside Store', description: 'Ground equipment spares and safety gear near T2 airside', airportId: mumbai.id },
  });
  const bomWhElec = await prisma.warehouse.create({
    data: { name: 'Airfield Electrical Shed', description: 'Aviation lighting spares and cables', airportId: mumbai.id },
  });
  const blrWhLog = await prisma.warehouse.create({
    data: { name: 'General Logistics Depot', description: 'Consumables, tools and furniture warehouse', airportId: bengaluru.id },
  });
  const blrWhAtc = await prisma.warehouse.create({
    data: { name: 'ATC Tech Spares Yard', description: 'Air Traffic Control console spares and networking hardware', airportId: bengaluru.id },
  });

  console.log('Seeding Users...');
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('Admin@1234', salt);
  const mgrPasswordHash = bcrypt.hashSync('Manager@1234', salt);
  const staffPasswordHash = bcrypt.hashSync('Staff@1234', salt);
  const reqPasswordHash = bcrypt.hashSync('Req@1234', salt);
  const audPasswordHash = bcrypt.hashSync('Auditor@1234', salt);

  const superAdmin = await prisma.user.create({
    data: { employeeId: 'EMP001', name: 'Rajesh Kumar', email: 'admin@aerostock.aai.aero', passwordHash, role: Role.SUPER_ADMIN },
  });
  const delhiMgr = await prisma.user.create({
    data: { employeeId: 'EMP002', name: 'Amit Sharma', email: 'delhi.mgr@aerostock.aai.aero', passwordHash: mgrPasswordHash, role: Role.AIRPORT_MGR, airportId: delhi.id },
  });
  const mumbaiMgr = await prisma.user.create({
    data: { employeeId: 'EMP003', name: 'Sanjay Patil', email: 'mumbai.mgr@aerostock.aai.aero', passwordHash: mgrPasswordHash, role: Role.AIRPORT_MGR, airportId: mumbai.id },
  });
  const delhiStaff = await prisma.user.create({
    data: { employeeId: 'EMP004', name: 'Vikram Singh', email: 'delhi.staff@aerostock.aai.aero', passwordHash: staffPasswordHash, role: Role.STAFF, airportId: delhi.id },
  });
  const delhiReq = await prisma.user.create({
    data: { employeeId: 'EMP005', name: 'Neha Gupta', email: 'delhi.req@aerostock.aai.aero', passwordHash: reqPasswordHash, role: Role.REQUESTER, airportId: delhi.id },
  });
  const auditor = await prisma.user.create({
    data: { employeeId: 'EMP006', name: 'Priya Iyer', email: 'auditor@aerostock.aai.aero', passwordHash: audPasswordHash, role: Role.AUDITOR },
  });

  console.log('Seeding Categories...');
  const catSpare = await prisma.category.create({ data: { name: 'Spare Parts', description: 'Mechanical parts, motors, valves, seals, and runway lighting elements' } });
  const catGse = await prisma.category.create({ data: { name: 'Ground Support Equipment', description: 'Tugs, GPU cables, towbars, hydraulic pumps, and support tools' } });
  const catSafety = await prisma.category.create({ data: { name: 'Safety & Fire Gear', description: 'Fire extinguishers, SCBA gear, PPE, protective suits, and runway sweepers' } });
  const catIt = await prisma.category.create({ data: { name: 'IT & Networking', description: 'Servers, routers, switches, fiber cables, VHF radios, and desktop units' } });
  const catElec = await prisma.category.create({ data: { name: 'Electrical', description: 'High-mast floodlights, generators, relays, transformers, and industrial cables' } });
  const catConsumable = await prisma.category.create({ data: { name: 'Consumables', description: 'De-icing fluids, airfield marking paint, lubricants, and stationery' } });

  console.log('Seeding Suppliers...');
  const bel = await prisma.supplier.create({
    data: { name: 'Bharat Electronics Limited', contactPerson: 'H. S. Rao', email: 'hsrao@bel.co.in', phone: '080-22195300', address: 'Outer Ring Road, Bengaluru', gstin: '29AAACB1234F1Z1', rating: 4.8, leadTimeDays: 7 },
  });
  const honeywell = await prisma.supplier.create({
    data: { name: 'Honeywell Airport Systems', contactPerson: 'David Miller', email: 'david.miller@honeywell.com', phone: '022-66991000', address: 'T2 Terminal Road, Mumbai', gstin: '27AAACH5678A1Z0', rating: 4.6, leadTimeDays: 10 },
  });
  const raytheon = await prisma.supplier.create({
    data: { name: 'Raytheon CNS Solutions', contactPerson: 'John Doe', email: 'cns.sales@raytheon.com', phone: '+1-555-0199', address: 'Waltham, Massachusetts, USA', gstin: '07AAAAC9999M1Z9', rating: 4.4, leadTimeDays: 14 },
  });
  const havells = await prisma.supplier.create({
    data: { name: 'Havells India Ltd', contactPerson: 'Ravi Malhotra', email: 'ravi.malhotra@havells.com', phone: '0120-3331000', address: 'QRG Towers, Noida', gstin: '08AAACH1111B1Z2', rating: 4.7, leadTimeDays: 3 },
  });
  const aeroshield = await prisma.supplier.create({
    data: { name: 'AeroShield Fire & Safety Ltd', contactPerson: 'Meera Sen', email: 'meera.s@aeroshield.in', phone: '011-25611200', address: 'Dwarka Sector 8, New Delhi', gstin: '29AAACA2222C1Z4', rating: 4.5, leadTimeDays: 5 },
  });

  console.log('Seeding Items (SKUs)...');
  const itemDefinitions = [
    // Spare Parts
    { name: 'Runway Edge Light LED 24V', skuCode: 'AAI-SP-RWY-001', categoryId: catSpare.id, unitOfMeasure: 'PCS', reorderThreshold: 15, reorderQuantity: 30, unitCost: 12500, supplierId: honeywell.id, barcodeValue: '8901234000010' },
    { name: 'Aerobridge Hydraulic Seal Kit', skuCode: 'AAI-SP-ABG-002', categoryId: catSpare.id, unitOfMeasure: 'SETS', reorderThreshold: 5, reorderQuantity: 10, unitCost: 45000, supplierId: honeywell.id, barcodeValue: '8901234000027' },
    { name: 'Conveyor Belt Motor 3-Phase', skuCode: 'AAI-SP-CVB-003', categoryId: catSpare.id, unitOfMeasure: 'PCS', reorderThreshold: 3, reorderQuantity: 5, unitCost: 85000, supplierId: bel.id, barcodeValue: '8901234000034' },
    { name: 'Elevator Guide Rail Bracket', skuCode: 'AAI-SP-ELV-004', categoryId: catSpare.id, unitOfMeasure: 'PCS', reorderThreshold: 10, reorderQuantity: 20, unitCost: 3500, supplierId: honeywell.id, barcodeValue: '8901234000041' },
    { name: 'Escalator Handrail Drive Chain', skuCode: 'AAI-SP-ESC-005', categoryId: catSpare.id, unitOfMeasure: 'PCS', reorderThreshold: 4, reorderQuantity: 8, unitCost: 22000, supplierId: honeywell.id, barcodeValue: '8901234000058' },
    { name: 'ILS Glideslope Antenna Cable', skuCode: 'AAI-SP-NAV-006', categoryId: catSpare.id, unitOfMeasure: 'METERS', reorderThreshold: 100, reorderQuantity: 300, unitCost: 850, supplierId: raytheon.id, barcodeValue: '8901234000065' },
    { name: 'Radar Cooling Fan Assembly', skuCode: 'AAI-SP-RDR-007', categoryId: catSpare.id, unitOfMeasure: 'PCS', reorderThreshold: 2, reorderQuantity: 5, unitCost: 55000, supplierId: raytheon.id, barcodeValue: '8901234000072' },
    
    // GSE
    { name: 'Towbar Shear Pin Boeing 737', skuCode: 'AAI-GSE-PIN-010', categoryId: catGse.id, unitOfMeasure: 'PCS', reorderThreshold: 20, reorderQuantity: 50, unitCost: 1500, supplierId: bel.id, barcodeValue: '8901234000102' },
    { name: 'GPU Cable Connector 400Hz', skuCode: 'AAI-GSE-GPU-011', categoryId: catGse.id, unitOfMeasure: 'PCS', reorderThreshold: 4, reorderQuantity: 10, unitCost: 28000, supplierId: honeywell.id, barcodeValue: '8901234000119' },
    { name: 'Baggage Tractor Battery 80V', skuCode: 'AAI-GSE-TRC-012', categoryId: catGse.id, unitOfMeasure: 'PCS', reorderThreshold: 2, reorderQuantity: 4, unitCost: 140000, supplierId: bel.id, barcodeValue: '8901234000126' },
    { name: 'Hydraulic Fluid H515 20L', skuCode: 'AAI-GSE-HYD-013', categoryId: catGse.id, unitOfMeasure: 'CANS', reorderThreshold: 10, reorderQuantity: 25, unitCost: 8000, supplierId: honeywell.id, barcodeValue: '8901234000133' },
    { name: 'Aircraft Cabin Air Filter', skuCode: 'AAI-GSE-CAF-014', categoryId: catGse.id, unitOfMeasure: 'PCS', reorderThreshold: 15, reorderQuantity: 40, unitCost: 4800, supplierId: honeywell.id, barcodeValue: '8901234000140' },
    { name: 'Pushback Tug Brake Pad Set', skuCode: 'AAI-GSE-BRK-015', categoryId: catGse.id, unitOfMeasure: 'SETS', reorderThreshold: 6, reorderQuantity: 12, unitCost: 18500, supplierId: bel.id, barcodeValue: '8901234000157' },

    // Safety & Fire Gear
    { name: 'Fire Extinguisher CO2 4.5kg', skuCode: 'AAI-SF-EXT-020', categoryId: catSafety.id, unitOfMeasure: 'PCS', reorderThreshold: 25, reorderQuantity: 50, unitCost: 3500, supplierId: aeroshield.id, barcodeValue: '8901234000201' },
    { name: 'SCBA Oxygen Cylinder 6L', skuCode: 'AAI-SF-OXY-021', categoryId: catSafety.id, unitOfMeasure: 'PCS', reorderThreshold: 8, reorderQuantity: 15, unitCost: 29000, supplierId: aeroshield.id, barcodeValue: '8901234000218' },
    { name: 'Firefighter Kevlar Suit L', skuCode: 'AAI-SF-SUT-022', categoryId: catSafety.id, unitOfMeasure: 'SETS', reorderThreshold: 4, reorderQuantity: 10, unitCost: 110000, supplierId: aeroshield.id, barcodeValue: '8901234000225' },
    { name: 'Runway FOD Sweeper Broom', skuCode: 'AAI-SF-FOD-023', categoryId: catSafety.id, unitOfMeasure: 'PCS', reorderThreshold: 6, reorderQuantity: 12, unitCost: 16500, supplierId: aeroshield.id, barcodeValue: '8901234000232' },
    { name: 'High-Visibility Safety Vest', skuCode: 'AAI-SF-VST-024', categoryId: catSafety.id, unitOfMeasure: 'PCS', reorderThreshold: 50, reorderQuantity: 200, unitCost: 250, supplierId: aeroshield.id, barcodeValue: '8901234000249' },
    { name: 'First Aid Trauma Kit Class A', skuCode: 'AAI-SF-FAK-025', categoryId: catSafety.id, unitOfMeasure: 'PCS', reorderThreshold: 10, reorderQuantity: 20, unitCost: 4500, supplierId: aeroshield.id, barcodeValue: '8901234000256' },

    // IT & Networking
    { name: 'ATC Console Monitor 24"', skuCode: 'AAI-IT-MON-030', categoryId: catIt.id, unitOfMeasure: 'PCS', reorderThreshold: 6, reorderQuantity: 12, unitCost: 32000, supplierId: bel.id, barcodeValue: '8901234000300' },
    { name: 'Cisco Catalyst Switch 24-Port', skuCode: 'AAI-IT-SWI-031', categoryId: catIt.id, unitOfMeasure: 'PCS', reorderThreshold: 3, reorderQuantity: 6, unitCost: 75000, supplierId: bel.id, barcodeValue: '8901234000317' },
    { name: 'Cat6 Ethernet Cable Roll 305m', skuCode: 'AAI-IT-CBL-032', categoryId: catIt.id, unitOfMeasure: 'ROLLS', reorderThreshold: 5, reorderQuantity: 15, unitCost: 9500, supplierId: havells.id, barcodeValue: '8901234000324' },
    { name: 'SFP Fiber Transceiver 10G', skuCode: 'AAI-IT-SFP-033', categoryId: catIt.id, unitOfMeasure: 'PCS', reorderThreshold: 15, reorderQuantity: 40, unitCost: 4500, supplierId: bel.id, barcodeValue: '8901234000331' },
    { name: 'Server Rack PDU 16A', skuCode: 'AAI-IT-PDU-034', categoryId: catIt.id, unitOfMeasure: 'PCS', reorderThreshold: 4, reorderQuantity: 8, unitCost: 11200, supplierId: havells.id, barcodeValue: '8901234000348' },
    { name: 'VHF Radio Handset IC-A16', skuCode: 'AAI-IT-VHF-035', categoryId: catIt.id, unitOfMeasure: 'PCS', reorderThreshold: 8, reorderQuantity: 20, unitCost: 24500, supplierId: raytheon.id, barcodeValue: '8901234000355' },
    { name: 'Thermal Boarding Pass Printer', skuCode: 'AAI-IT-PRN-036', categoryId: catIt.id, unitOfMeasure: 'PCS', reorderThreshold: 5, reorderQuantity: 10, unitCost: 18000, supplierId: bel.id, barcodeValue: '8901234000362' },

    // Electrical
    { name: 'LED Floodlight 200W High Mast', skuCode: 'AAI-EL-FLD-040', categoryId: catElec.id, unitOfMeasure: 'PCS', reorderThreshold: 12, reorderQuantity: 25, unitCost: 14500, supplierId: havells.id, barcodeValue: '8901234000409' },
    { name: 'PVC Insulated Cable 4C 16mm', skuCode: 'AAI-EL-CBL-041', categoryId: catElec.id, unitOfMeasure: 'METERS', reorderThreshold: 200, reorderQuantity: 500, unitCost: 450, supplierId: havells.id, barcodeValue: '8901234000416' },
    { name: 'Circuit Breaker 3-Phase 100A', skuCode: 'AAI-EL-MCB-042', categoryId: catElec.id, unitOfMeasure: 'PCS', reorderThreshold: 8, reorderQuantity: 20, unitCost: 6500, supplierId: havells.id, barcodeValue: '8901234000423' },
    { name: 'Diesel Generator Oil Filter', skuCode: 'AAI-EL-GEN-043', categoryId: catElec.id, unitOfMeasure: 'PCS', reorderThreshold: 10, reorderQuantity: 20, unitCost: 2800, supplierId: honeywell.id, barcodeValue: '8901234000430' },
    { name: 'Runway Cable Jointing Kit', skuCode: 'AAI-EL-JNT-044', categoryId: catElec.id, unitOfMeasure: 'SETS', reorderThreshold: 10, reorderQuantity: 20, unitCost: 5500, supplierId: havells.id, barcodeValue: '8901234000447' },
    { name: 'UPS Battery Lead-Acid 12V', skuCode: 'AAI-EL-UPS-045', categoryId: catElec.id, unitOfMeasure: 'PCS', reorderThreshold: 20, reorderQuantity: 40, unitCost: 9500, supplierId: havells.id, barcodeValue: '8901234000454' },

    // Consumables
    { name: 'Runway De-icing Fluid 200L', skuCode: 'AAI-CS-ICE-050', categoryId: catConsumable.id, unitOfMeasure: 'BARRELS', reorderThreshold: 8, reorderQuantity: 20, unitCost: 35000, supplierId: honeywell.id, barcodeValue: '8901234000508' },
    { name: 'Marking Paint White 20L', skuCode: 'AAI-CS-PNT-051', categoryId: catConsumable.id, unitOfMeasure: 'CANS', reorderThreshold: 15, reorderQuantity: 40, unitCost: 4500, supplierId: havells.id, barcodeValue: '8901234000515' },
    { name: 'Glass Cleaner Concentrated 5L', skuCode: 'AAI-CS-GLS-052', categoryId: catConsumable.id, unitOfMeasure: 'CANS', reorderThreshold: 10, reorderQuantity: 20, unitCost: 1200, supplierId: havells.id, barcodeValue: '8901234000522' },
    { name: 'Cable Ties Nylon Pack 1000', skuCode: 'AAI-CS-TIE-053', categoryId: catConsumable.id, unitOfMeasure: 'PACKS', reorderThreshold: 20, reorderQuantity: 50, unitCost: 750, supplierId: havells.id, barcodeValue: '8901234000539' },
    { name: 'WD-40 Lubricant Spray 400ml', skuCode: 'AAI-CS-WD4-054', categoryId: catConsumable.id, unitOfMeasure: 'BOTTLES', reorderThreshold: 30, reorderQuantity: 100, unitCost: 350, supplierId: honeywell.id, barcodeValue: '8901234000546' },
    { name: 'Boarding Pass Roll Pack 10', skuCode: 'AAI-CS-BPR-055', categoryId: catConsumable.id, unitOfMeasure: 'PACKS', reorderThreshold: 15, reorderQuantity: 40, unitCost: 1800, supplierId: bel.id, barcodeValue: '8901234000553' },
  ];

  const items = [];
  for (const itemDef of itemDefinitions) {
    const item = await prisma.item.create({ data: itemDef });
    items.push(item);
  }

  console.log('Seeding Stock Levels & historical transactions...');
  const warehouses = [delWhMain, delWhCns, bomWhAirside, bomWhElec, blrWhLog, blrWhAtc];
  
  // Set up date offsets for historical transactions over the last 90 days
  const now = new Date();
  const generateHistoryDate = (daysAgo: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    return date;
  };

  for (const item of items) {
    for (const wh of warehouses) {
      // Simulate historical flow to calculate current quantities deterministically
      let qty = 0;
      let reservedQty = 0;

      // 1. Initial Load (90 days ago) - Load a base quantity
      const initDaysAgo = 90;
      const initialQty = Math.floor(Math.random() * 80) + 40; // 40 to 120
      qty += initialQty;

      await prisma.stockTransaction.create({
        data: {
          transactionType: TransactionType.IN,
          itemId: item.id,
          warehouseId: wh.id,
          quantity: initialQty,
          referenceNumber: `PO-INIT-${wh.id.substring(0, 4).toUpperCase()}`,
          performedByUserId: superAdmin.id,
          reason: 'Initial Inventory Setup',
          timestamp: generateHistoryDate(initDaysAgo),
        },
      });

      // 2. Regular consumption & replenishment cycles (6 transactions over last 90 days)
      const txnOffsets = [75, 60, 45, 30, 15, 5];
      for (let i = 0; i < txnOffsets.length; i++) {
        const daysAgo = txnOffsets[i];
        const randomState = Math.random();

        if (randomState < 0.5) {
          // Consume items (OUT)
          const consumeQty = Math.floor(Math.random() * 15) + 5; // 5 to 20
          if (qty >= consumeQty) {
            qty -= consumeQty;
            await prisma.stockTransaction.create({
              data: {
                transactionType: TransactionType.OUT,
                itemId: item.id,
                warehouseId: wh.id,
                quantity: consumeQty,
                referenceNumber: `REQ-SIM-${daysAgo}`,
                performedByUserId: delhiStaff.id,
                reason: 'Department Dispatch',
                timestamp: generateHistoryDate(daysAgo),
              },
            });
          }
        } else if (randomState < 0.75) {
          // Replenish (IN)
          const replenishQty = Math.floor(Math.random() * 40) + 20; // 20 to 60
          qty += replenishQty;
          await prisma.stockTransaction.create({
            data: {
              transactionType: TransactionType.IN,
              itemId: item.id,
              warehouseId: wh.id,
              quantity: replenishQty,
              referenceNumber: `PO-SIM-${daysAgo}`,
              performedByUserId: delhiStaff.id,
              reason: 'Purchase Order Delivery',
              timestamp: generateHistoryDate(daysAgo),
            },
          });
        } else if (randomState < 0.85) {
          // Damaged stock (DAMAGED)
          const damageQty = Math.floor(Math.random() * 3) + 1; // 1 to 3
          if (qty >= damageQty) {
            qty -= damageQty;
            await prisma.stockTransaction.create({
              data: {
                transactionType: TransactionType.DAMAGED,
                itemId: item.id,
                warehouseId: wh.id,
                quantity: damageQty,
                referenceNumber: `ADJ-DMG-${daysAgo}`,
                performedByUserId: delhiStaff.id,
                reason: 'Water exposure / Physical damage during handling',
                timestamp: generateHistoryDate(daysAgo),
              },
            });
          }
        } else {
          // Adjustments (ADJUSTMENT)
          const adjustQty = Math.floor(Math.random() * 5) - 2; // -2 to +2
          if (qty + adjustQty >= 0) {
            qty += adjustQty;
            await prisma.stockTransaction.create({
              data: {
                transactionType: TransactionType.ADJUSTMENT,
                itemId: item.id,
                warehouseId: wh.id,
                quantity: Math.abs(adjustQty),
                referenceNumber: `ADJ-CNT-${daysAgo}`,
                performedByUserId: delhiStaff.id,
                reason: adjustQty >= 0 ? 'Stock Count Surplus Correction' : 'Stock Count Discrepancy Shrinkage',
                timestamp: generateHistoryDate(daysAgo),
              },
            });
          }
        }
      }

      // Ensure some items fall below the reorder point to trigger dashboard widgets
      // We force low stock for a few select items at specific warehouses
      const isLowStockItem = item.skuCode === 'AAI-SP-RWY-001' && wh.id === delWhMain.id;
      const isOutOfStockItem = item.skuCode === 'AAI-IT-SWI-031' && wh.id === delWhCns.id;

      if (isLowStockItem) {
        qty = 4; // Below threshold (15)
      } else if (isOutOfStockItem) {
        qty = 0; // Out of stock
      }

      // Seed Stock Level records
      await prisma.stockLevel.create({
        data: {
          itemId: item.id,
          warehouseId: wh.id,
          quantity: qty,
          reservedQuantity: reservedQty,
          availableQuantity: qty - reservedQty,
        },
      });
    }
  }

  console.log('Seeding Requisitions...');
  // FULFILLED Requisition
  const req1 = await prisma.requisition.create({
    data: {
      reqNumber: 'REQ-2026-0001',
      requestingDepartment: 'CNS',
      airportId: delhi.id,
      requestedByUserId: delhiReq.id,
      approvedByUserId: delhiMgr.id,
      status: ReqStatus.FULFILLED,
      comments: 'All components checked and issued from CNS Spares Store.',
      createdAt: generateHistoryDate(10),
    },
  });
  await prisma.requisitionItem.create({
    data: { requisitionId: req1.id, itemId: items[5].id, quantityRequested: 50, quantityFulfilled: 50 }, // Antenna Cable
  });

  // APPROVED Requisition (Awaiting fulfillment)
  const req2 = await prisma.requisition.create({
    data: {
      reqNumber: 'REQ-2026-0002',
      requestingDepartment: 'Operations',
      airportId: delhi.id,
      requestedByUserId: delhiReq.id,
      approvedByUserId: delhiMgr.id,
      status: ReqStatus.APPROVED,
      comments: 'Approved. Warehouse staff please dispatch.',
      createdAt: generateHistoryDate(2),
    },
  });
  await prisma.requisitionItem.create({
    data: { requisitionId: req2.id, itemId: items[13].id, quantityRequested: 10, quantityFulfilled: 0 }, // CO2 Fire Extinguishers
  });

  // PENDING Requisition
  const req3 = await prisma.requisition.create({
    data: {
      reqNumber: 'REQ-2026-0003',
      requestingDepartment: 'Fire Services',
      airportId: delhi.id,
      requestedByUserId: delhiReq.id,
      status: ReqStatus.PENDING,
      comments: 'Urgent replacement requested for next shift drills.',
      createdAt: generateHistoryDate(1),
    },
  });
  await prisma.requisitionItem.create({
    data: { requisitionId: req3.id, itemId: items[15].id, quantityRequested: 2, quantityFulfilled: 0 }, // Kevlar Suits
  });

  // REJECTED Requisition
  const req4 = await prisma.requisition.create({
    data: {
      reqNumber: 'REQ-2026-0004',
      requestingDepartment: 'IT',
      airportId: delhi.id,
      requestedByUserId: delhiReq.id,
      approvedByUserId: delhiMgr.id,
      status: ReqStatus.REJECTED,
      comments: 'Declined. Please route through central IT approval.',
      createdAt: generateHistoryDate(4),
    },
  });
  await prisma.requisitionItem.create({
    data: { requisitionId: req4.id, itemId: items[20].id, quantityRequested: 1, quantityFulfilled: 0 }, // Cisco Switch
  });

  console.log('Seeding Purchase Orders...');
  // RECEIVED Purchase Order
  const po1 = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-0001',
      supplierId: honeywell.id,
      status: POStatus.RECEIVED,
      totalCost: 375000,
      expectedDeliveryDate: generateHistoryDate(5),
      createdByUserId: delhiMgr.id,
      approvedByUserId: superAdmin.id,
      createdAt: generateHistoryDate(12),
    },
  });
  await prisma.purchaseOrderItem.create({
    data: { purchaseOrderId: po1.id, itemId: items[0].id, quantityOrdered: 30, quantityReceived: 30, unitCost: 12500 }, // Runway Edge Lights
  });

  // PARTIALLY RECEIVED Purchase Order
  const po2 = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-0002',
      supplierId: bel.id,
      status: POStatus.PARTIALLY_RECEIVED,
      totalCost: 565000,
      expectedDeliveryDate: generateHistoryDate(1),
      createdByUserId: delhiMgr.id,
      approvedByUserId: superAdmin.id,
      createdAt: generateHistoryDate(8),
    },
  });
  await prisma.purchaseOrderItem.create({
    data: { purchaseOrderId: po2.id, itemId: items[2].id, quantityOrdered: 5, quantityReceived: 3, unitCost: 85000 }, // Conveyor Belt Motor
  });
  await prisma.purchaseOrderItem.create({
    data: { purchaseOrderId: po2.id, itemId: items[7].id, quantityOrdered: 50, quantityReceived: 50, unitCost: 1500 }, // Towbar Shear Pin
  });

  // ORDERED (In-transit)
  const po3 = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-0003',
      supplierId: raytheon.id,
      status: POStatus.ORDERED,
      totalCost: 122500,
      expectedDeliveryDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      createdByUserId: mumbaiMgr.id,
      approvedByUserId: superAdmin.id,
      createdAt: generateHistoryDate(3),
    },
  });
  await prisma.purchaseOrderItem.create({
    data: { purchaseOrderId: po3.id, itemId: items[24].id, quantityOrdered: 5, quantityReceived: 0, unitCost: 24500 }, // VHF Handsets
  });

  // PENDING APPROVAL
  const po4 = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-0004',
      supplierId: aeroshield.id,
      status: POStatus.PENDING_APPROVAL,
      totalCost: 290000,
      expectedDeliveryDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      createdByUserId: delhiMgr.id,
      createdAt: generateHistoryDate(1),
    },
  });
  await prisma.purchaseOrderItem.create({
    data: { purchaseOrderId: po4.id, itemId: items[14].id, quantityOrdered: 10, quantityReceived: 0, unitCost: 29000 }, // SCBA Cylinder
  });

  console.log('Seeding Maintenance Records...');
  await prisma.maintenanceRecord.create({
    data: {
      itemId: items[2].id, // Conveyor belt motor
      warehouseId: delWhMain.id,
      status: 'SCHEDULED',
      nextServiceDue: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
      description: 'Quarterly lubrication and motor winding insulation health check.',
    },
  });
  await prisma.maintenanceRecord.create({
    data: {
      itemId: items[6].id, // Radar cooling fan
      warehouseId: delWhCns.id,
      status: 'IN_PROGRESS',
      lastServiceDate: generateHistoryDate(90),
      nextServiceDue: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
      description: 'Emergency bearing noise investigation.',
      performedBy: 'BEL Field Services Team',
    },
  });

  console.log('Seeding Notifications...');
  await prisma.notification.create({
    data: { userId: delhiMgr.id, title: 'Low Stock Alert', message: 'Runway Edge Light LED 24V (AAI-SP-RWY-001) has fallen below reorder threshold.', type: 'LOW_STOCK' },
  });
  await prisma.notification.create({
    data: { userId: delhiMgr.id, title: 'Requisition Approval Needed', message: 'Neha Gupta (CNS) submitted REQ-2026-0003 for approval.', type: 'REQUISITION_APPROVAL' },
  });
  await prisma.notification.create({
    data: { userId: superAdmin.id, title: 'PO Approval Needed', message: 'Delhi Airport submitted PO-2026-0004 for approval.', type: 'PO_STATUS' },
  });

  console.log('Seeding complete! Database pre-loaded for flight-ready testing.');
}

main()
  .catch((e) => {
    console.error('Error during database seed execution:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
