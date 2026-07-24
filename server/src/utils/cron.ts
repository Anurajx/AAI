import cron from 'node-cron';
import { prisma } from '../db';
import { notifyUsersByRole } from './notifications';

/**
 * Initializes background cron jobs for the application.
 */
export const initCronJobs = () => {
  // Run daily at 8:00 AM (0 8 * * *)
  cron.schedule('0 8 * * *', async () => {
    console.log('[Cron] Running scheduled daily stock level audit...');
    await checkLowStockAndNotify();
  });
};

/**
 * Scans all stock levels and triggers alerts for items below their reorder threshold.
 */
export const checkLowStockAndNotify = async () => {
  try {
    const allStockLevels = await prisma.stockLevel.findMany({
      include: {
        item: true,
        warehouse: {
          include: {
            airport: true,
          },
        },
      },
    });

    const lowStock = allStockLevels.filter(
      (sl) => sl.quantity <= sl.item.reorderThreshold
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const sl of lowStock) {
      const message = `Item "${sl.item.name}" (${sl.item.skuCode}) at ${sl.warehouse.name} (${sl.warehouse.airport.code}) has fallen to ${sl.quantity} ${sl.item.unitOfMeasure} (Reorder Threshold: ${sl.item.reorderThreshold}).`;

      // Check if we've already notified today to prevent spam
      const existingNotif = await prisma.notification.findFirst({
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
        await notifyUsersByRole(
          'AIRPORT_MGR',
          'Low Stock Alert',
          message,
          'LOW_STOCK',
          sl.warehouse.airportId
        );

        // Notify global admins
        await notifyUsersByRole(
          'SUPER_ADMIN',
          'Low Stock Alert',
          message,
          'LOW_STOCK'
        );
      }
    }
  } catch (error) {
    console.error('[Cron] Error running low stock checks:', error);
  }
};
