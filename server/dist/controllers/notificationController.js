"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllAsRead = exports.markAsRead = exports.getNotifications = void 0;
const db_1 = require("../db");
const getNotifications = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        const notifications = await db_1.prisma.notification.findMany({
            where: {
                userId: req.user.userId,
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        return res.status(200).json({ success: true, data: notifications });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
    }
};
exports.getNotifications = getNotifications;
const markAsRead = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        const { id } = req.params;
        const notif = await db_1.prisma.notification.findUnique({ where: { id } });
        if (!notif)
            return res.status(404).json({ success: false, error: 'Notification not found' });
        if (notif.userId !== req.user.userId) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        const updated = await db_1.prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });
        return res.status(200).json({ success: true, data: updated });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to update notification status' });
    }
};
exports.markAsRead = markAsRead;
const markAllAsRead = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        await db_1.prisma.notification.updateMany({
            where: {
                userId: req.user.userId,
                isRead: false
            },
            data: { isRead: true }
        });
        return res.status(200).json({ success: true, message: 'All notifications marked as read' });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to update notifications' });
    }
};
exports.markAllAsRead = markAllAsRead;
