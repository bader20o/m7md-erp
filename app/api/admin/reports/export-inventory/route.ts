import { Role } from "@prisma/client";
import ExcelJS from "exceljs";
import { fail } from "@/lib/api";
import { workbookToResponse, autoFitColumns, styleHeader } from "@/lib/excel";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

const DATE_FORMAT = "yyyy-mm-dd hh:mm";
const JOD_FORMAT = '0.00 "JOD"';

function displayUserName(user: { fullName: string | null; phone: string }): string {
  return user.fullName || user.phone;
}

function movementDirection(type: string, note: string | null): "IN" | "OUT" {
  if (type === "OUT" || type === "SALE") return "OUT";
  if (type === "IN") return "IN";
  if (note?.startsWith("[OUT]")) return "OUT";
  return "IN";
}

export async function GET(): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ADMIN]);

    const [parts, movements] = await Promise.all([
      prisma.part.findMany({
        orderBy: { name: "asc" }
      }),
      prisma.stockMovement.findMany({
        include: {
          part: { select: { id: true, name: true } },
          createdBy: { select: { fullName: true, phone: true } }
        },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        take: 5000
      })
    ]);

    const lastMovementMap = new Map<string, Date | null>();
    for (const part of parts) {
      lastMovementMap.set(part.id, null);
    }
    for (const movement of movements) {
      if (!lastMovementMap.get(movement.partId)) {
        lastMovementMap.set(movement.partId, movement.occurredAt);
      }
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Admin";
    workbook.created = new Date();

    const itemsSheet = workbook.addWorksheet("Items");
    const itemsHeader = itemsSheet.addRow([
      "name",
      "vehicleModel",
      "vehicleType",
      "category",
      "defaultUnitPrice (JOD)",
      "qtyOnHand",
      "minQty",
      "isActive"
    ]);
    styleHeader(itemsHeader);
    for (const part of parts) {
      const row = itemsSheet.addRow([
        part.name,
        part.vehicleModel ?? "",
        part.vehicleType ?? "",
        part.category ?? "",
        part.sellPrice ?? 0,
        part.stockQty,
        part.lowStockThreshold,
        part.isActive ? "true" : "false"
      ]);
      row.getCell(5).numFmt = JOD_FORMAT;
    }
    autoFitColumns(itemsSheet);

    const summarySheet = workbook.addWorksheet("Stock Summary");
    const summaryHeader = summarySheet.addRow(["item", "qtyOnHand", "lastMovementDate"]);
    styleHeader(summaryHeader);
    for (const part of parts) {
      const row = summarySheet.addRow([
        part.name,
        part.stockQty,
        lastMovementMap.get(part.id) ?? ""
      ]);
      if (row.getCell(3).value instanceof Date) {
        row.getCell(3).numFmt = DATE_FORMAT;
      }
    }
    autoFitColumns(summarySheet);

    const movementSheet = workbook.addWorksheet("Stock Movements");
    const movementHeader = movementSheet.addRow([
      "date",
      "item",
      "IN/OUT",
      "quantity",
      "note",
      "createdBy"
    ]);
    styleHeader(movementHeader);
    for (const movement of movements) {
      const row = movementSheet.addRow([
        movement.occurredAt,
        movement.part.name,
        movementDirection(movement.type, movement.note),
        movement.quantity,
        movement.note ?? "",
        displayUserName(movement.createdBy)
      ]);
      row.getCell(1).numFmt = DATE_FORMAT;
    }
    autoFitColumns(movementSheet);

    return workbookToResponse(workbook, `inventory-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (error) {
    return fail(error);
  }
}
