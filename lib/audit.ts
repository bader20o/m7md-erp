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
  const userAgent = requestHeaders.get("user-agent");
  const payload =
    input.payload && typeof input.payload === "object"
      ? { ...(input.payload as Record<string, unknown>), userAgent }
      : userAgent
        ? { userAgent }
        : undefined;

  await prisma.auditLog.create({
    data: {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      actorId: input.actorId,
      payload: payload as object | undefined,
      ipAddress
    }
  });
}
