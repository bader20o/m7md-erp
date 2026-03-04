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
  let ipAddress: string | null = null;
  let userAgent: string | null = null;

  try {
    const requestHeaders = await headers();
    const forwarded = requestHeaders.get("x-forwarded-for");
    ipAddress = forwarded?.split(",")[0]?.trim() ?? null;
    userAgent = requestHeaders.get("user-agent");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("outside a request scope")) {
      throw error;
    }
  }

  const payload =
    input.payload && typeof input.payload === "object"
      ? { ...(input.payload as Record<string, unknown>), userAgent }
      : userAgent
        ? { userAgent }
        : undefined;

  try {
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
  } catch (error) {
    console.error("AUDIT_LOG_WRITE_FAILED", error);
  }
}
