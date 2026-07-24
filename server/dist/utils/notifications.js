"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyUsersByRole = exports.createNotification = void 0;
const db_1 = require("../db");
/**
 * Creates an in-app notification for a user.
 */
const createNotification = async (userId, title, message, type) => {
    try {
        return await db_1.prisma.notification.create({
            data: {
                userId,
                title,
                message,
                type,
            },
        });
    }
    catch (error) {
        console.error('Failed to create notification:', error);
    }
};
exports.createNotification = createNotification;
/**
 * Sends notifications to all users with a specific role, optionally scoped to an airport.
 */
const notifyUsersByRole = async (role, title, message, type, airportId) => {
    try {
        const users = await db_1.prisma.user.findMany({
            where: {
                role,
                ...(airportId ? { airportId } : {}),
            },
        });
        for (const user of users) {
            await (0, exports.createNotification)(user.id, title, message, type);
        }
    }
    catch (error) {
        console.error('Failed to notify users by role:', error);
    }
};
exports.notifyUsersByRole = notifyUsersByRole;
