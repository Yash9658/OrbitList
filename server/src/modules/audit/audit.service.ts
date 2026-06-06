import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";

function mapAuditLog(log: {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  createdAt: Date;
  actor: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
  } | null;
}) {
  return {
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    metadata: log.metadata,
    createdAt: log.createdAt,
    actor: log.actor
  };
}

export async function createAuditLog(input: {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown> | null;
}) {
  return prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? undefined
    }
  });
}

export async function listAuditLogs(limit: number) {
  const logs = await prisma.auditLog.findMany({
    include: {
      actor: {
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: limit
  });

  return {
    data: logs.map(mapAuditLog),
    meta: {
      total: logs.length
    }
  };
}
