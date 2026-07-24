"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = void 0;
const db_1 = require("../db");
/**
 * Creates an entry in the system audit log.
 */
const logAudit = async (userId, action, entityName, entityId, beforeState = null, afterState = null) => {
    try {
        await db_1.prisma.auditLog.create({
            data: {
                userId,
                action,
                entityName,
                entityId,
                beforeState: beforeState ? JSON.stringify(beforeState) : null,
                afterState: afterState ? JSON.stringify(afterState) : null,
            },
        });
    }
    catch (error) {
        console.error('Failed to log audit activity:', error);
    }
};
exports.logAudit = logAudit;
