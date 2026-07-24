import { Request, Response } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';
import * as bcrypt from 'bcryptjs';
import { logAudit } from '../utils/audit';

export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'AUDITOR')) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const users = await prisma.user.findMany({
      include: { airport: true },
      orderBy: { name: 'asc' }
    });

    // Strip passwords before sending
    const safeUsers = users.map(user => {
      const { passwordHash, ...safe } = user;
      return safe;
    });

    return res.status(200).json({ success: true, data: safeUsers });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
};

export const createUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Access denied: Only Super Admins can create users' });
    }

    const { employeeId, name, email, password, role, airportId } = req.body;

    if (!employeeId || !name || !email || !password || !role) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    const existingUser = await prisma.user.findFirst({
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

    const user = await prisma.user.create({
      data: {
        employeeId,
        name,
        email,
        passwordHash,
        role,
        airportId: airportId || null
      }
    });

    await logAudit(req.user.userId, 'CREATE_USER', 'User', user.id, null, { email: user.email, role: user.role });

    const { passwordHash: _, ...safeUser } = user;
    return res.status(201).json({ success: true, data: safeUser });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to create user' });
  }
};

export const updateUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Access denied: Only Super Admins can update users' });
    }

    const { name, email, role, airportId, password } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const data: any = { name, email, role, airportId: airportId || null };

    if (password && password.trim() !== '') {
      const salt = bcrypt.genSaltSync(10);
      data.passwordHash = bcrypt.hashSync(password, salt);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data
    });

    await logAudit(req.user.userId, 'UPDATE_USER', 'User', id, { role: user.role }, { role: updatedUser.role });

    const { passwordHash: _, ...safeUser } = updatedUser;
    return res.status(200).json({ success: true, data: safeUser });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update user' });
  }
};

export const getAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'AUDITOR')) {
      return res.status(403).json({ success: false, error: 'Access denied: Audit logs are restricted' });
    }

    const { action, entityName } = req.query;

    const where: any = {};
    if (action) {
      where.action = String(action);
    }
    if (entityName) {
      where.entityName = String(entityName);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { name: true, employeeId: true, role: true } }
      },
      orderBy: { timestamp: 'desc' },
      take: 100 // Cap to prevent massive payloads
    });

    return res.status(200).json({ success: true, data: logs });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
};
