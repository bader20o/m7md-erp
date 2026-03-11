import { IncomeSource, Role, StockMovementType, TransactionType } from "@prisma/client";
import ExcelJS from "exceljs";
import { z } from "zod";
import { fail } from "@/lib/api";
import { workbookToResponse, autoFitColumns, styleHeader } from "@/lib/excel";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { parseDateOnlyUtc } from "@/lib/validators/reports";

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_FORMAT = "yyyy-mm-dd hh:mm";
const JOD_FORMAT = '0.00 "JOD"';

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function expenseMagnitude(item: { amount: unknown }): number {
  return Math.abs(Number(item.amount));
}

export async function GET(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ADMIN]);
    const url = new URL(request.url);
    const query = await querySchema.parseAsync({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined
    });

    const fromStart = query.from ? parseDateOnlyUtc(query.from) : new Date("1970-01-01T00:00:00.000Z");
    const toStart = query.to ? parseDateOnlyUtc(query.to) : new Date();
    const toEnd = new Date(toStart.getTime() + DAY_MS - 1);

    const [transactions, parts, stockMovements] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          deletedAt: null,
          occurredAt: {
            gte: fromStart,
            lte: toEnd
          }
        },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }]
      }),
      prisma.part.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" }
      }),
      prisma.stockMovement.findMany({
        where: {
          occurredAt: {
            gte: fromStart,
            lte: toEnd
          },
          OR: [
            { type: StockMovementType.SALE },
            {
              type: StockMovementType.OUT,
              note: { contains: "sold", mode: "insensitive" }
            }
          ]
        },
        include: {
          part: {
            select: {
              name: true
            }
          }
        },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }]
      })
    ]);

    const totalIncome = transactions
      .filter((item) => item.type === TransactionType.INCOME)
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const totalExpenses = transactions
      .filter((item) => item.type === TransactionType.EXPENSE)
      .reduce((sum, item) => sum + expenseMagnitude(item), 0);
    const inventorySaleIncome = transactions
      .filter(
        (item) =>
          item.type === TransactionType.INCOME &&
          (item.incomeSource === IncomeSource.INVOICE || item.incomeSource === IncomeSource.INVENTORY_SALE)
      )
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const soldQty = stockMovements.reduce((sum, item) => sum + item.quantity, 0);

    const lowStockCount = parts.filter((part) => part.stockQty <= part.lowStockThreshold).length;
    const stockValueEstimate = parts.reduce(
      (sum, part) => sum + part.stockQty * Number(part.sellPrice ?? 0),
      0
    );

    const incomeByDate = new Map<string, number>();
    for (const transaction of transactions) {
      if (
        transaction.type === TransactionType.INCOME &&
        (transaction.incomeSource === IncomeSource.INVOICE || transaction.incomeSource === IncomeSource.INVENTORY_SALE)
      ) {
        const key = dateKey(transaction.occurredAt);
        incomeByDate.set(key, (incomeByDate.get(key) ?? 0) + Number(transaction.amount));
      }
    }

    const qtyByDate = new Map<string, number>();
    for (const movement of stockMovements) {
      const key = dateKey(movement.occurredAt);
      qtyByDate.set(key, (qtyByDate.get(key) ?? 0) + movement.quantity);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Admin";
    workbook.created = new Date();

    const accountingSheet = workbook.addWorksheet("Accounting");
    styleHeader(
      accountingSheet.addRow(["rangeFrom", "rangeTo", "totalIncome", "totalExpenses", "netProfit", "inventorySaleIncome"])
    );
    const totalsRow = accountingSheet.addRow([fromStart, toEnd, totalIncome, totalExpenses, totalIncome - totalExpenses, inventorySaleIncome]);
    totalsRow.getCell(1).numFmt = DATE_FORMAT;
    totalsRow.getCell(2).numFmt = DATE_FORMAT;
    totalsRow.getCell(3).numFmt = JOD_FORMAT;
    totalsRow.getCell(4).numFmt = JOD_FORMAT;
    totalsRow.getCell(5).numFmt = JOD_FORMAT;
    totalsRow.getCell(6).numFmt = JOD_FORMAT;

    accountingSheet.addRow([]);
    styleHeader(
      accountingSheet.addRow(["date", "type", "incomeSource", "expenseCategory", "item", "qty", "unitPrice", "amount"])
    );
    for (const item of transactions) {
      const row = accountingSheet.addRow([
        item.occurredAt,
        item.type,
        item.incomeSource ?? "",
        item.expenseCategory ?? "",
        item.itemName,
        item.quantity,
        Number(item.unitPrice),
        Number(item.amount)
      ]);
      row.getCell(1).numFmt = DATE_FORMAT;
      row.getCell(7).numFmt = JOD_FORMAT;
      row.getCell(8).numFmt = JOD_FORMAT;
    }
    autoFitColumns(accountingSheet);

    const inventorySheet = workbook.addWorksheet("Inventory");
    styleHeader(
      inventorySheet.addRow(["name", "vehicleModel", "vehicleType", "defaultPrice", "quantity", "minQty", "lowStock"])
    );
    for (const part of parts) {
      const row = inventorySheet.addRow([
        part.name,
        part.vehicleModel ?? "",
        part.vehicleType ?? "",
        Number(part.sellPrice ?? 0),
        part.stockQty,
        part.lowStockThreshold,
        part.stockQty <= part.lowStockThreshold ? "YES" : "NO"
      ]);
      row.getCell(4).numFmt = JOD_FORMAT;
    }
    autoFitColumns(inventorySheet);

    const reconciliationSheet = workbook.addWorksheet("Reconciliation");
    styleHeader(
      reconciliationSheet.addRow(["metric", "value"])
    );
    const summaryRows: Array<[string, number]> = [
      ["Inventory Units Sold", soldQty],
      ["Inventory Sale Income (JOD)", inventorySaleIncome],
      ["Low Stock Items", lowStockCount],
      ["Inventory Stock Value Estimate (JOD)", stockValueEstimate]
    ];
    for (const [metric, value] of summaryRows) {
      const row = reconciliationSheet.addRow([metric, value]);
      if (metric.includes("JOD")) {
        row.getCell(2).numFmt = JOD_FORMAT;
      }
    }

    reconciliationSheet.addRow([]);
    styleHeader(
      reconciliationSheet.addRow(["date", "soldQty", "saleIncomeJOD"])
    );
    const keys = Array.from(new Set([...incomeByDate.keys(), ...qtyByDate.keys()])).sort();
    for (const key of keys) {
      const row = reconciliationSheet.addRow([key, qtyByDate.get(key) ?? 0, incomeByDate.get(key) ?? 0]);
      row.getCell(3).numFmt = JOD_FORMAT;
    }
    autoFitColumns(reconciliationSheet);

    const suffix = `${fromStart.toISOString().slice(0, 10)}-to-${toEnd.toISOString().slice(0, 10)}`;
    return workbookToResponse(workbook, `reconciliation-${suffix}.xlsx`);
  } catch (error) {
    return fail(error);
  }
}
