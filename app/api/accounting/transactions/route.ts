import { Role } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value === "bigint") return Number(value);
  if (value && typeof value === "object" && "toString" in value) {
    return Number(value.toString());
  }
  return 0;
}

export async function GET(): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);

    const itemsAsc = await prisma.transaction.findMany({
      where: { deletedAt: null },
      include: {
        booking: true,
        expense: { include: { supplier: true, invoice: true } },
        membershipOrder: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            phone: true
          }
        },
        updatedBy: {
          select: {
            id: true,
            fullName: true,
            phone: true
          }
        },
        invoice: {
          include: {
            invoiceLines: {
              include: { part: true }
            }
          }
        }
      },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }]
    });

    let runningBalance = 0;
    const withRunningBalance = itemsAsc.map((item) => {
      const amount = toNumber(item.amount);
      runningBalance += item.type === "INCOME" ? amount : -amount;
      return {
        ...item,
        runningBalance: Number(runningBalance.toFixed(2))
      };
    });

    const items = withRunningBalance.sort((a, b) => {
      const diff = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
      if (diff !== 0) return diff;
      return b.id.localeCompare(a.id);
    });

    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}


