"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditLogs = exports.updateUser = exports.createUser = exports.getUsers = void 0;
const db_1 = require("../db");
const bcrypt = __importStar(require("bcryptjs"));
const audit_1 = require("../utils/audit");
const getUsers = async (req, res) => {
    try {
        if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'AUDITOR')) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        const users = await db_1.prisma.user.findMany({
            include: { airport: true },
            orderBy: { name: 'asc' }
        });
        // Strip passwords before sending
        const safeUsers = users.map(user => {
            const { passwordHash, ...safe } = user;
            return safe;
        });
        return res.status(200).json({ success: true, data: safeUsers });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
};
exports.getUsers = getUsers;
const createUser = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ success: false, error: 'Access denied: Only Super Admins can create users' });
        }
        const { employeeId, name, email, password, role, airportId } = req.body;
        if (!employeeId || !name || !email || !password || !role) {
            return res.status(400).json({ success: false, error: 'All fields are required' });
        }
        const existingUser = await db_1.prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    { employeeId }
                ]
            }
        });
        if (existingUser) {
            return res.status(400).json({ success: false, error: 'User with this email or employee ID already exists' });
        }
        const salt = bcrypt.genSaltSync(10);
        const passwordHash = bcrypt.hashSync(password, salt);
        const user = await db_1.prisma.user.create({
            data: {
                employeeId,
                name,
                email,
                passwordHash,
                role,
                airportId: airportId || null
            }
        });
        await (0, audit_1.logAudit)(req.user.userId, 'CREATE_USER', 'User', user.id, null, { email: user.email, role: user.role });
        const { passwordHash: _, ...safeUser } = user;
        return res.status(201).json({ success: true, data: safeUser });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to create user' });
    }
};
exports.createUser = createUser;
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.user || req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ success: false, error: 'Access denied: Only Super Admins can update users' });
        }
        const { name, email, role, airportId, password } = req.body;
        const user = await db_1.prisma.user.findUnique({ where: { id } });
        if (!user)
            return res.status(404).json({ success: false, error: 'User not found' });
        const data = { name, email, role, airportId: airportId || null };
        if (password && password.trim() !== '') {
            const salt = bcrypt.genSaltSync(10);
            data.passwordHash = bcrypt.hashSync(password, salt);
        }
        const updatedUser = await db_1.prisma.user.update({
            where: { id },
            data
        });
        await (0, audit_1.logAudit)(req.user.userId, 'UPDATE_USER', 'User', id, { role: user.role }, { role: updatedUser.role });
        const { passwordHash: _, ...safeUser } = updatedUser;
        return res.status(200).json({ success: true, data: safeUser });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to update user' });
    }
};
exports.updateUser = updateUser;
const getAuditLogs = async (req, res) => {
    try {
        if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'AUDITOR')) {
            return res.status(403).json({ success: false, error: 'Access denied: Audit logs are restricted' });
        }
        const { action, entityName } = req.query;
        const where = {};
        if (action) {
            where.action = String(action);
        }
        if (entityName) {
            where.entityName = String(entityName);
        }
        const logs = await db_1.prisma.auditLog.findMany({
            where,
            include: {
                user: { select: { name: true, employeeId: true, role: true } }
            },
            orderBy: { timestamp: 'desc' },
            take: 100 // Cap to prevent massive payloads
        });
        return res.status(200).json({ success: true, data: logs });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
    }
};
exports.getAuditLogs = getAuditLogs;
