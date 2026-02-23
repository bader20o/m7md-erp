import { CustomerAccountEntryType, Role } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission, requireRoles } from "@/lib/rbac";

type BalanceRow = {
  customerId: string;
  type: CustomerAccountEntryType;
  amount: unknown;
};

function computeBalances(rows: BalanceRow[]): Map<string, number> {
  const balances = new Map<string, number>();
  for (const row of rows) {
    const current = balances.get(row.customerId) ?? 0;
    const amount = Number(row.amount);
    if (row.type === CustomerAccountEntryType.PAYMENT) {
      balances.set(row.customerId, current - amount);
    } else {
      balances.set(row.customerId, current + amount);
    }
  }
  return balances;
}

export async function GET(): Promise<Response> {
  try {
    const session = await getSession();
    if (session?.role === Role.ADMIN) {
      requireRoles(session, [Role.ADMIN]);
    } else {
      await requireAnyPermission(session, ["analytics", "accounting"]);
    }

    const rows = await prisma.customerAccountEntry.findMany({
      select: {
        customerId: true,
        type: true,
        amount: true
      }
    });

    const balances = computeBalances(rows);
    const positiveBalances = Array.from(balances.entries())
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1]);

    const customerIds = positiveBalances.slice(0, 10).map(([customerId]) => customerId);
    const customers = customerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: customerIds } },
          select: {
            id: true,
            fullName: true,
            phone: true,
            avatarUrl: true
          }
        })
      : [];
    const customerMap = new Map(customers.map((item) => [item.id, item]));

    const totalOutstanding = positiveBalances.reduce((sum, [, value]) => sum + value, 0);
    const countCustomersWithDebt = positiveBalances.length;

    return ok({
      totalOutstanding: Number(totalOutstanding.toFixed(2)),
      countCustomersWithDebt,
      topCustomersByDebt: positiveBalances.slice(0, 5).map(([customerId, amount]) => ({
        customerId,
        fullName: customerMap.get(customerId)?.fullName ?? null,
        phone: customerMap.get(customerId)?.phone ?? null,
        avatarUrl: customerMap.get(customerId)?.avatarUrl ?? null,
        balanceDue: Number(amount.toFixed(2))
      }))
    });
  } catch (error) {
    return fail(error);
  }
}

