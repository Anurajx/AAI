import { prisma } from '../db';

/**
 * Creates an entry in the system audit log.
 */
export const logAudit = async (
  userId: string,
  action: string,
  entityName: string,
  entityId: string,
  beforeState: any = null,
  afterState: any = null
) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityName,
        entityId,
        beforeState: beforeState ? JSON.stringify(beforeState) : null,
        afterState: afterState ? JSON.stringify(afterState) : null,
      },
    });
  } catch (error) {
    console.error('Failed to log audit activity:', error);
  }
};
