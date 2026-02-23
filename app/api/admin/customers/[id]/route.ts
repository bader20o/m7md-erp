import { CustomerAccountEntryType, Role, UserStatus } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission, requireRoles } from "@/lib/rbac";
import { generateTemporaryPassword } from "@/lib/security";

const updateCustomerSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("suspend"),
    reason: z.string().max(300).optional()
  }),
  z.object({
    action: z.literal("activate")
  }),
  z.object({
    action: z.literal("ban"),
    durationDays: z.coerce.number().int().min(1).max(3650).optional(),
    banReason: z.string().max(300).optional(),
    banMessage: z.string().max(400).optional()
  }),
  z.object({
    action: z.literal("unban")
  }),
  z.object({
    action: z.literal("reset_password")
  }),
  z.object({
    action: z.literal("force_password_reset")
  }),
  z.object({
    action: z.literal("update_profile"),
    fullName: z.string().min(2).max(120).optional(),
    bio: z.string().max(280).nullable().optional(),
    carType: z.string().max(120).nullable().optional(),
    location: z.string().max(120).nullable().optional(),
    avatarUrl: z.string().max(1000).nullable().optional()
  })
]);

type Params = { params: Promise<{ id: string }> };

function computeBalanceDue(entries: Array<{ type: CustomerAccountEntryType; amount: unknown }>): number {
  return Number(
    entries
      .reduce((sum, entry) => {
        const amount = Number(entry.amount);
        if (entry.type === CustomerAccountEntryType.PAYMENT) {
          return sum - amount;
        }
        return sum + amount;
      }, 0)
      .toFixed(2)
  );
}

export async function GET(_: Request, context: Params): Promise<Response> {
  try {
    const session = await getSession();
    if (session?.role === Role.ADMIN) {
      requireRoles(session, [Role.ADMIN]);
    } else {
      await requireAnyPermission(session, ["bookings", "accounting"]);
    }

    const { id } = await context.params;
    const customer = await prisma.user.findFirst({
      where: {
        id,
        role: Role.CUSTOMER
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        role: true,
        status: true,
        bio: true,
        carType: true,
        location: true,
        avatarUrl: true,
        createdAt: true,
        bannedUntil: true,
        banReason: true,
        banMessage: true,
        customerLedgerEntries: {
          orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
          take: 200,
          select: {
            id: true,
            type: true,
            amount: true,
            occurredAt: true,
            note: true,
            createdAt: true,
            referenceType: true,
            referenceId: true,
            createdByAdmin: {
              select: {
                id: true,
                fullName: true,
                phone: true
              }
            }
          }
        }
      }
    });

    if (!customer) {
      throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
    }

    const balanceDue = computeBalanceDue(customer.customerLedgerEntries);

    return ok({
      item: {
        ...customer,
        joinedAt: customer.createdAt,
        status: customer.status.toLowerCase(),
        balanceDue
      }
    });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, context: Params): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.ADMIN]);
    const body = await parseJsonBody(request, updateCustomerSchema);
    const { id } = await context.params;

    const target = await prisma.user.findFirst({
      where: { id, role: Role.CUSTOMER },
      select: { id: true, status: true }
    });
    if (!target) {
      throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
    }

    let temporaryPassword: string | null = null;
    let updated;

    if (body.action === "suspend") {
      updated = await prisma.user.update({
        where: { id },
        data: {
          status: UserStatus.SUSPENDED,
          isActive: false,
          suspendedAt: new Date(),
          suspensionReason: body.reason ?? null,
          suspendedByAdminId: actor.sub
        }
      });
    } else if (body.action === "activate") {
      updated = await prisma.user.update({
        where: { id },
        data: {
          status: UserStatus.ACTIVE,
          isActive: true,
          suspendedAt: null,
          suspensionReason: null,
          suspendedByAdminId: null,
          bannedUntil: null,
          banReason: null,
          banMessage: null,
          bannedByAdminId: null
        }
      });
    } else if (body.action === "ban") {
      const bannedUntil = body.durationDays
        ? new Date(Date.now() + body.durationDays * 24 * 60 * 60 * 1000)
        : null;
      updated = await prisma.user.update({
        where: { id },
        data: {
          status: UserStatus.BANNED,
          isActive: false,
          bannedUntil,
          banReason: body.banReason ?? null,
          banMessage: body.banMessage ?? null,
          bannedByAdminId: actor.sub
        }
      });
    } else if (body.action === "unban") {
      updated = await prisma.user.update({
        where: { id },
        data: {
          status: UserStatus.ACTIVE,
          isActive: true,
          bannedUntil: null,
          banReason: null,
          banMessage: null,
          bannedByAdminId: null
        }
      });
    } else if (body.action === "reset_password") {
      temporaryPassword = generateTemporaryPassword();
      updated = await prisma.user.update({
        where: { id },
        data: {
          passwordHash: await hashPassword(temporaryPassword),
          forcePasswordReset: true,
          mustChangePassword: true,
          lastPasswordChangeAt: null
        }
      });
    } else if (body.action === "force_password_reset") {
      updated = await prisma.user.update({
        where: { id },
        data: {
          forcePasswordReset: true,
          mustChangePassword: true
        }
      });
    } else {
      updated = await prisma.user.update({
        where: { id },
        data: {
          fullName: body.fullName,
          bio: body.bio,
          carType: body.carType,
          location: body.location,
          avatarUrl: body.avatarUrl
        }
      });
    }

    await logAudit({
      action: `CUSTOMER_${body.action.toUpperCase()}`,
      entity: "User",
      entityId: id,
      actorId: actor.sub,
      payload: {
        previousStatus: target.status,
        newStatus: updated.status
      }
    });

    return ok({
      item: {
        id: updated.id,
        status: updated.status.toLowerCase(),
        joinedAt: updated.createdAt
      },
      temporaryPassword
    });
  } catch (error) {
    return fail(error);
  }
}

