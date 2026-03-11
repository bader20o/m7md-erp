import { Role, TransactionType } from "@prisma/client";
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

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
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

    const items = await prisma.transaction.findMany({
      where: {
        deletedAt: null,
        occurredAt: {
          gte: fromStart,
          lte: toEnd
        }
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }]
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Admin";
    workbook.created = new Date();

    const transactionsSheet = workbook.addWorksheet("Transactions");
    const transactionsHeader = transactionsSheet.addRow([
      "date",
      "type",
      "item",
      "quantity",
      "unitPrice",
      "amount (JOD)",
      "note"
    ]);
    styleHeader(transactionsHeader);
    for (const item of items) {
      const row = transactionsSheet.addRow([
        item.occurredAt,
        item.type,
        item.itemName,
        item.quantity,
        item.unitPrice,
        Number(item.amount),
        item.note ?? ""
      ]);
      row.getCell(1).numFmt = DATE_FORMAT;
      row.getCell(5).numFmt = JOD_FORMAT;
      row.getCell(6).numFmt = JOD_FORMAT;
    }
    autoFitColumns(transactionsSheet);

    const salesSheet = workbook.addWorksheet("Sales");
    const salesHeader = salesSheet.addRow([
      "date",
      "type",
      "item",
      "quantity",
      "unitPrice",
      "amount (JOD)",
      "note"
    ]);
    styleHeader(salesHeader);
    const salesItems = items.filter(
      (item) => item.type === TransactionType.INCOME && item.referenceType === "INVENTORY_SALE"
    );
    for (const item of salesItems) {
      const row = salesSheet.addRow([
        item.occurredAt,
        item.type,
        item.itemName,
        item.quantity,
        item.unitPrice,
        Number(item.amount),
        item.note ?? ""
      ]);
      row.getCell(1).numFmt = DATE_FORMAT;
      row.getCell(5).numFmt = JOD_FORMAT;
      row.getCell(6).numFmt = JOD_FORMAT;
    }
    autoFitColumns(salesSheet);

    const totalIncome = items.reduce(
      (sum, item) => (item.type === TransactionType.INCOME ? sum + Number(item.amount) : sum),
      0
    );
    const totalExpenses = items.reduce(
      (sum, item) => (item.type === TransactionType.EXPENSE ? sum + expenseMagnitude(item) : sum),
      0
    );
    const netProfit = totalIncome - totalExpenses;

    const summaryByDay = new Map<
      string,
      { income: number; expenses: number; net: number; from: Date; to: Date }
    >();
    for (const item of items) {
      const key = dateKey(item.occurredAt);
      const existing = summaryByDay.get(key) ?? {
        income: 0,
        expenses: 0,
        net: 0,
        from: new Date(`${key}T00:00:00.000Z`),
        to: new Date(`${key}T23:59:59.999Z`)
      };
      if (item.type === TransactionType.INCOME) {
        existing.income += Number(item.amount);
      } else {
        existing.expenses += expenseMagnitude(item);
      }
      existing.net = existing.income - existing.expenses;
      summaryByDay.set(key, existing);
    }

    const summarySheet = workbook.addWorksheet("Summary");
    const summaryHeader = summarySheet.addRow([
      "rangeFrom",
      "rangeTo",
      "total income",
      "total expenses",
      "net profit"
    ]);
    styleHeader(summaryHeader);
    const summaryRow = summarySheet.addRow([fromStart, toEnd, totalIncome, totalExpenses, netProfit]);
    summaryRow.getCell(1).numFmt = DATE_FORMAT;
    summaryRow.getCell(2).numFmt = DATE_FORMAT;
    summaryRow.getCell(3).numFmt = JOD_FORMAT;
    summaryRow.getCell(4).numFmt = JOD_FORMAT;
    summaryRow.getCell(5).numFmt = JOD_FORMAT;

    summarySheet.addRow([]);
    const groupedHeader = summarySheet.addRow([
      "date range",
      "income",
      "expenses",
      "net profit"
    ]);
    styleHeader(groupedHeader);
    for (const [key, value] of Array.from(summaryByDay.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    )) {
      const groupedRow = summarySheet.addRow([
        key,
        value.income,
        value.expenses,
        value.net
      ]);
      groupedRow.getCell(2).numFmt = JOD_FORMAT;
      groupedRow.getCell(3).numFmt = JOD_FORMAT;
      groupedRow.getCell(4).numFmt = JOD_FORMAT;
    }
    autoFitColumns(summarySheet);

    const suffix = `${fromStart.toISOString().slice(0, 10)}-to-${toEnd.toISOString().slice(0, 10)}`;
    return workbookToResponse(workbook, `accounting-${suffix}.xlsx`);
  } catch (error) {
    return fail(error);
  }
}
