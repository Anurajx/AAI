import { prisma } from '../db';

/**
 * Creates an in-app notification for a user.
 */
export const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type: string
) => {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
      },
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};

/**
 * Sends notifications to all users with a specific role, optionally scoped to an airport.
 */
export const notifyUsersByRole = async (
  role: 'SUPER_ADMIN' | 'AIRPORT_MGR' | 'STAFF' | 'REQUESTER' | 'AUDITOR',
  title: string,
  message: string,
  type: string,
  airportId?: string
) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        role,
        ...(airportId ? { airportId } : {}),
      },
    });

    for (const user of users) {
      await createNotification(user.id, title, message, type);
    }
  } catch (error) {
    console.error('Failed to notify users by role:', error);
  }
};
