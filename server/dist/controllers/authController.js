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
exports.getMe = exports.logout = exports.refresh = exports.login = void 0;
const bcrypt = __importStar(require("bcryptjs"));
const db_1 = require("../db");
const schemas_1 = require("../validation/schemas");
const jwt_1 = require("../utils/jwt");
const audit_1 = require("../utils/audit");
const login = async (req, res) => {
    try {
        const parseResult = schemas_1.LoginSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ success: false, error: parseResult.error.errors[0].message });
        }
        const { email, password } = parseResult.data;
        const user = await db_1.prisma.user.findUnique({
            where: { email },
            include: { airport: true }
        });
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }
        const isMatch = bcrypt.compareSync(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }
        const payload = {
            userId: user.id,
            employeeId: user.employeeId,
            role: user.role,
            airportId: user.airportId
        };
        const accessToken = (0, jwt_1.generateAccessToken)(payload);
        const refreshToken = (0, jwt_1.generateRefreshToken)(user.id);
        await (0, audit_1.logAudit)(user.id, 'USER_LOGIN', 'User', user.id, null, { email: user.email });
        return res.status(200).json({
            success: true,
            data: {
                accessToken,
                refreshToken,
                user: {
                    id: user.id,
                    employeeId: user.employeeId,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    airport: user.airport ? {
                        id: user.airport.id,
                        code: user.airport.code,
                        name: user.airport.name
                    } : null
                }
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.login = login;
const refresh = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ success: false, error: 'Refresh token is required' });
        }
        const decoded = (0, jwt_1.verifyRefreshToken)(refreshToken);
        const user = await db_1.prisma.user.findUnique({
            where: { id: decoded.userId }
        });
        if (!user) {
            return res.status(401).json({ success: false, error: 'User not found' });
        }
        const payload = {
            userId: user.id,
            employeeId: user.employeeId,
            role: user.role,
            airportId: user.airportId
        };
        const accessToken = (0, jwt_1.generateAccessToken)(payload);
        return res.status(200).json({
            success: true,
            data: { accessToken }
        });
    }
    catch (error) {
        return res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
    }
};
exports.refresh = refresh;
const logout = async (req, res) => {
    try {
        if (req.user) {
            await (0, audit_1.logAudit)(req.user.userId, 'USER_LOGOUT', 'User', req.user.userId);
        }
        return res.status(200).json({ success: true, message: 'Logged out successfully' });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.logout = logout;
const getMe = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        const user = await db_1.prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true,
                employeeId: true,
                name: true,
                email: true,
                role: true,
                airport: {
                    select: {
                        id: true,
                        code: true,
                        name: true
                    }
                }
            }
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        return res.status(200).json({
            success: true,
            data: user
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.getMe = getMe;
