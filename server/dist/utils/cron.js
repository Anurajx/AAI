"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkLowStockAndNotify = exports.initCronJobs = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const db_1 = require("../db");
const notifications_1 = require("./notifications");
/**
 * Initializes background cron jobs for the application.
 */
const initCronJobs = () => {
    // Run daily at 8:00 AM (0 8 * * *)
    node_cron_1.default.schedule('0 8 * * *', async () => {
        console.log('[Cron] Running scheduled daily stock level audit...');
        await (0, exports.checkLowStockAndNotify)();
    });
};
exports.initCronJobs = initCronJobs;
/**
 * Scans all stock levels and triggers alerts for items below their reorder threshold.
 */
const checkLowStockAndNotify = async () => {
    try {
        const allStockLevels = await db_1.prisma.stockLevel.findMany({
            include: {
                item: true,
                warehouse: {
                    include: {
                        airport: true,
                    },
                },
            },
        });
        const lowStock = allStockLevels.filter((sl) => sl.quantity <= sl.item.reorderThreshold);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (const sl of lowStock) {
            const message = `Item "${sl.item.name}" (${sl.item.skuCode}) at ${sl.warehouse.name} (${sl.warehouse.airport.code}) has fallen to ${sl.quantity} ${sl.item.unitOfMeasure} (Reorder Threshold: ${sl.item.reorderThreshold}).`;
            // Check if we've already notified today to prevent spam
            const existingNotif = await db_1.prisma.notification.findFirst({
                where: {
                    title: 'Low Stock Alert',
                    message: {
                        contains: `${sl.item.skuCode}`,
                    },
                    createdAt: {
                        gte: today,
                    },
                },
            });
            if (!existingNotif) {
                // Notify managers assigned to this airport
                await (0, notifications_1.notifyUsersByRole)('AIRPORT_MGR', 'Low Stock Alert', message, 'LOW_STOCK', sl.warehouse.airportId);
                // Notify global admins
                await (0, notifications_1.notifyUsersByRole)('SUPER_ADMIN', 'Low Stock Alert', message, 'LOW_STOCK');
            }
        }
    }
    catch (error) {
        console.error('[Cron] Error running low stock checks:', error);
    }
};
exports.checkLowStockAndNotify = checkLowStockAndNotify;
