import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  action: string;
  entity: string;
  entityId?: string;
  actorId?: string;
  payload?: unknown;
};

export async function logAudit(input: AuditInput): Promise<void> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() ?? null;

  await prisma.auditLog.create({
    data: {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      actorId: input.actorId,
      payload: input.payload as object | undefined,
      ipAddress
    }
  });
}

