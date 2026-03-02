/**
 * ERP/POS-grade Invoice ↔ Inventory Integration Service
 *
 * Core principle: Item price is NOT fixed.
 * Part.sellPrice is a suggestion; actual sale price lives on each InvoiceLine.
 *
 * Three line types:
 *   INVENTORY — linked to Part, deducts stock, creates StockMovement
 *   OUTSIDE   — no Part link, no stock impact, income only
 *   SERVICE   — no stock impact, optionally linked to a Service
 */

import {
    CustomerAccountEntryType,
    IncomeSource,
    InvoiceLineType,
    InvoiceStatus,
    InvoiceType,
    Prisma,
    Role,
    StockMovementType,
    TransactionType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────

export interface SaleInvoiceLineInput {
    partId?: string | null;
    serviceId?: string | null;
    lineType: "INVENTORY" | "OUTSIDE" | "SERVICE";
    description: string;
    quantity: number;
    unitAmount: number; // actual sale price — freely editable
}

export interface CreateSaleInvoiceInput {
    number: string;
    note?: string;
    dueDate?: Date;
    issueDate?: Date;
    customerId?: string;
    lines: SaleInvoiceLineInput[];
}

export interface UpdateSaleInvoiceInput {
    note?: string;
    dueDate?: Date;
    customerId?: string;
    lines: SaleInvoiceLineInput[];
}

// ── Helpers ────────────────────────────────────────────────────────────

function computeLineTotal(qty: number, unitAmount: number): number {
    return Number((qty * unitAmount).toFixed(2));
}

function computeInvoiceTotal(
    lines: Array<{ quantity: number; unitAmount: number }>
): number {
    return lines.reduce(
        (sum, l) => sum + computeLineTotal(l.quantity, l.unitAmount),
        0
    );
}

function isPostgres(): boolean {
    const url = process.env.DATABASE_URL ?? "";
    return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

async function lockPartsForUpdate(
    tx: Prisma.TransactionClient,
    partIds: string[]
): Promise<void> {
    if (!partIds.length || !isPostgres()) return;
    await tx.$queryRaw`SELECT id FROM "Part" WHERE id IN (${Prisma.join(partIds)}) FOR UPDATE`;
}

function computeInventoryCostTotals(
    lines: SaleInvoiceLineInput[],
    partMap: Map<string, { costPrice: number | null }>
): { totalCost: number; avgUnitCost: number | null } {
    let totalQty = 0;
    let totalCost = 0;
    for (const line of lines) {
        if (line.lineType !== "INVENTORY" || !line.partId) continue;
        const part = partMap.get(line.partId);
        const unitCost = Number(part?.costPrice ?? 0);
        totalQty += line.quantity;
        totalCost += Number((unitCost * line.quantity).toFixed(2));
    }
    totalCost = Number(totalCost.toFixed(2));
    const avgUnitCost = totalQty > 0 ? Number((totalCost / totalQty).toFixed(2)) : null;
    return { totalCost, avgUnitCost };
}

// ── Create Sale Invoice ────────────────────────────────────────────────

export async function createSaleInvoice(
    input: CreateSaleInvoiceInput,
    actorId: string
) {
    const { number, note, dueDate, issueDate, customerId, lines } = input;

    if (!lines.length) {
        throw new ApiError(400, "NO_LINES", "Invoice must have at least one line.");
    }

    // Pre-validate: collect all partIds we need & check for duplicates
    const inventoryPartIds = lines
        .filter((l) => l.lineType === "INVENTORY" && l.partId)
        .map((l) => l.partId!);

    // Load parts upfront (outside transaction for validation messages)
    const parts =
        inventoryPartIds.length > 0
            ? await prisma.part.findMany({
                where: { id: { in: inventoryPartIds } },
                select: {
                    id: true,
                    name: true,
                    isActive: true,
                    stockQty: true,
                    costPrice: true,
                    sellPrice: true,
                },
            })
            : [];

    const partMap = new Map(parts.map((p) => [p.id, p]));

    // Validate all inventory lines have valid parts
    for (const line of lines) {
        if (line.lineType === "INVENTORY") {
            if (!line.partId) {
                throw new ApiError(
                    400,
                    "MISSING_PART_ID",
                    `INVENTORY line "${line.description}" requires a partId.`
                );
            }
            const part = partMap.get(line.partId);
            if (!part) {
                throw new ApiError(
                    404,
                    "PART_NOT_FOUND",
                    `Part "${line.partId}" not found.`
                );
            }
            if (!part.isActive) {
                throw new ApiError(
                    400,
                    "PART_INACTIVE",
                    `Part "${part.name}" is inactive.`
                );
            }
        }
    }

    // Aggregate quantity per part to check total demand
    const demandByPart = new Map<string, number>();
    for (const line of lines) {
        if (line.lineType === "INVENTORY" && line.partId) {
            demandByPart.set(
                line.partId,
                (demandByPart.get(line.partId) || 0) + line.quantity
            );
        }
    }
    for (const [partId, totalQty] of demandByPart) {
        const part = partMap.get(partId)!;
        if (part.stockQty < totalQty) {
            throw new ApiError(
                400,
                "INSUFFICIENT_STOCK",
                `Insufficient stock for "${part.name}": available ${part.stockQty}, requested ${totalQty}.`
            );
        }
    }

    const customer = customerId
        ? await prisma.user.findFirst({
            where: {
                id: customerId,
                role: Role.CUSTOMER
            },
            select: { id: true }
        })
        : null;
    if (customerId && !customer) {
        throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found for ledger update.");
    }

    const totalAmount = computeInvoiceTotal(lines);
    const { totalCost, avgUnitCost } = computeInventoryCostTotals(lines, partMap);
    const profitAmount = Number((totalAmount - totalCost).toFixed(2));

    // ── Atomic transaction ───────────────────────────────────────────
    const result = await prisma.$transaction(async (tx) => {
        await lockPartsForUpdate(tx, Array.from(demandByPart.keys()));
        // 1. Create the Invoice
        const invoice = await tx.invoice.create({
            data: {
                number,
                type: InvoiceType.SALE,
                note: note || null,
                status: InvoiceStatus.ISSUED,
                totalAmount,
                issueDate: issueDate ?? new Date(),
                dueDate: dueDate || null,
            },
        });

        // 2. Create lines + stock movements
        const createdLines = [];
        for (const line of lines) {
            const lineTotal = computeLineTotal(line.quantity, line.unitAmount);
            const part =
                line.lineType === "INVENTORY" && line.partId
                    ? partMap.get(line.partId)!
                    : null;

            const invoiceLine = await tx.invoiceLine.create({
                data: {
                    invoiceId: invoice.id,
                    partId: line.partId || null,
                    serviceId: line.serviceId || null,
                    lineType: line.lineType as InvoiceLineType,
                    description: line.description,
                    quantity: line.quantity,
                    unitAmount: line.unitAmount,
                    lineTotal,
                    costSnapshot: part?.costPrice != null ? part.costPrice : null,
                    createdById: actorId,
                    occurredAt: invoice.issueDate,
                },
            });
            createdLines.push(invoiceLine);

            // Stock deduction for INVENTORY lines
            if (line.lineType === "INVENTORY" && line.partId) {
                // Optimistic concurrency: only decrement if enough stock
                const updated = await tx.part.updateMany({
                    where: {
                        id: line.partId,
                        stockQty: { gte: line.quantity },
                    },
                    data: {
                        stockQty: { decrement: line.quantity },
                    },
                });

                if (updated.count === 0) {
                    throw new ApiError(
                        400,
                        "INSUFFICIENT_STOCK",
                        `Concurrent stock conflict for part "${part!.name}". Try again.`
                    );
                }

                await tx.stockMovement.create({
                    data: {
                        partId: line.partId,
                        type: StockMovementType.SALE,
                        quantity: line.quantity,
                        occurredAt: invoice.issueDate,
                        note: `Sale invoice ${invoice.number}`,
                        createdById: actorId,
                        invoiceId: invoice.id,
                    },
                });
            }
        }

        // 3. Create single aggregate INCOME transaction
        const transaction = await tx.transaction.create({
            data: {
                type: TransactionType.INCOME,
                incomeSource: IncomeSource.INVOICE,
                itemName: `Invoice ${invoice.number}`,
                unitPrice: totalAmount,
                quantity: 1,
                amount: totalAmount,
                sellPriceAtTimeOfSale: totalAmount,
                costAtTimeOfSale: avgUnitCost,
                costTotal: totalCost,
                profitAmount,
                note: note || `Sale invoice ${invoice.number}`,
                description: `Sale invoice ${invoice.number}`,
                invoiceId: invoice.id,
                referenceType: "INVOICE",
                referenceId: invoice.id,
                occurredAt: invoice.issueDate,
                recordedAt: new Date(),
                createdById: actorId,
                updatedById: actorId,
            },
        });

        let ledgerEntry = null;
        if (customer?.id) {
            ledgerEntry = await tx.customerAccountEntry.create({
                data: {
                    customerId: customer.id,
                    type: CustomerAccountEntryType.CHARGE,
                    amount: totalAmount,
                    occurredAt: invoice.issueDate,
                    note: note || `Sale invoice ${invoice.number}`,
                    createdByAdminId: actorId,
                    referenceType: "SALE_INVOICE",
                    referenceId: invoice.id
                }
            });
        }

        return { invoice, lines: createdLines, transaction, ledgerEntry };
    });

    return result;
}

// ── Update Sale Invoice ────────────────────────────────────────────────

export async function updateSaleInvoice(
    invoiceId: string,
    input: UpdateSaleInvoiceInput,
    actorId: string
) {
    const { note, dueDate, customerId, lines } = input;

    if (!lines.length) {
        throw new ApiError(400, "NO_LINES", "Invoice must have at least one line.");
    }

    // Load existing invoice
    const existing = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
            invoiceLines: true,
            transaction: true,
        },
    });

    if (!existing) {
        throw new ApiError(404, "INVOICE_NOT_FOUND", "Invoice not found.");
    }
    if (existing.type !== InvoiceType.SALE) {
        throw new ApiError(
            400,
            "NOT_SALE_INVOICE",
            "Only SALE invoices can be updated via this endpoint."
        );
    }
    if (existing.status === InvoiceStatus.VOID) {
        throw new ApiError(
            400,
            "INVOICE_VOIDED",
            "Cannot update a voided invoice."
        );
    }

    const existingLedgerCharge = await prisma.customerAccountEntry.findFirst({
        where: {
            referenceType: "SALE_INVOICE",
            referenceId: invoiceId,
            type: CustomerAccountEntryType.CHARGE
        },
        orderBy: { createdAt: "desc" },
        select: { customerId: true }
    });
    const customerIdForLedger = customerId ?? existingLedgerCharge?.customerId ?? null;
    if (customerIdForLedger) {
        const customer = await prisma.user.findFirst({
            where: {
                id: customerIdForLedger,
                role: Role.CUSTOMER
            },
            select: { id: true }
        });
        if (!customer) {
            throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found for ledger update.");
        }
    }

    // Pre-validate new inventory lines
    const inventoryPartIds = lines
        .filter((l) => l.lineType === "INVENTORY" && l.partId)
        .map((l) => l.partId!);

    const parts =
        inventoryPartIds.length > 0
            ? await prisma.part.findMany({
                where: { id: { in: inventoryPartIds } },
                select: {
                    id: true,
                    name: true,
                    isActive: true,
                    stockQty: true,
                    costPrice: true,
                    sellPrice: true,
                },
            })
            : [];

    const partMap = new Map(parts.map((p) => [p.id, p]));

    for (const line of lines) {
        if (line.lineType === "INVENTORY") {
            if (!line.partId) {
                throw new ApiError(
                    400,
                    "MISSING_PART_ID",
                    `INVENTORY line "${line.description}" requires a partId.`
                );
            }
            const part = partMap.get(line.partId);
            if (!part) {
                throw new ApiError(
                    404,
                    "PART_NOT_FOUND",
                    `Part "${line.partId}" not found.`
                );
            }
            if (!part.isActive) {
                throw new ApiError(
                    400,
                    "PART_INACTIVE",
                    `Part "${part.name}" is inactive.`
                );
            }
        }
    }

    // Compute the stock that was previously deducted (to restore)
    const oldDeductions = new Map<string, number>();
    for (const oldLine of existing.invoiceLines) {
        if (oldLine.lineType === "INVENTORY" && oldLine.partId) {
            oldDeductions.set(
                oldLine.partId,
                (oldDeductions.get(oldLine.partId) || 0) + oldLine.quantity
            );
        }
    }

    // Compute new demands
    const newDemands = new Map<string, number>();
    for (const line of lines) {
        if (line.lineType === "INVENTORY" && line.partId) {
            newDemands.set(
                line.partId,
                (newDemands.get(line.partId) || 0) + line.quantity
            );
        }
    }

    // Check net stock change: available = current + oldDeduction - newDemand >= 0
    const allPartIds = new Set([...oldDeductions.keys(), ...newDemands.keys()]);
    for (const partId of allPartIds) {
        const oldQty = oldDeductions.get(partId) || 0;
        const newQty = newDemands.get(partId) || 0;
        const netChange = newQty - oldQty; // positive = need more stock

        if (netChange > 0) {
            // We need to verify current stock can handle the additional demand
            const part = partMap.get(partId);
            if (!part) {
                // Part was deleted or not loaded — need to load it
                const freshPart = await prisma.part.findUnique({
                    where: { id: partId },
                    select: { stockQty: true, name: true },
                });
                if (!freshPart) {
                    throw new ApiError(
                        404,
                        "PART_NOT_FOUND",
                        `Part "${partId}" not found.`
                    );
                }
                if (freshPart.stockQty < netChange) {
                    throw new ApiError(
                        400,
                        "INSUFFICIENT_STOCK",
                        `Insufficient stock for "${freshPart.name}": available ${freshPart.stockQty}, additional needed ${netChange}.`
                    );
                }
            } else if (part.stockQty < netChange) {
                throw new ApiError(
                    400,
                    "INSUFFICIENT_STOCK",
                    `Insufficient stock for "${part.name}": available ${part.stockQty}, additional needed ${netChange}.`
                );
            }
        }
    }

    const totalAmount = computeInvoiceTotal(lines);
    const { totalCost, avgUnitCost } = computeInventoryCostTotals(lines, partMap);
    const profitAmount = Number((totalAmount - totalCost).toFixed(2));

    // ── Atomic transaction ───────────────────────────────────────────
    const result = await prisma.$transaction(async (tx) => {
        await lockPartsForUpdate(tx, Array.from(allPartIds));
        // 1. Restore old stock for all old INVENTORY lines
        for (const [partId, qty] of oldDeductions) {
            await tx.part.update({
                where: { id: partId },
                data: { stockQty: { increment: qty } },
            });
        }

        // 2. Delete old stock movements for this invoice
        await tx.stockMovement.deleteMany({
            where: { invoiceId },
        });

        // 3. Delete old invoice lines
        await tx.invoiceLine.deleteMany({
            where: { invoiceId },
        });

        // 4. Soft-delete old transaction
        if (existing.transaction) {
            await tx.transaction.update({
                where: { id: existing.transaction.id },
                data: {
                    deletedAt: new Date(),
                    deletedById: actorId,
                    updatedById: actorId,
                    invoiceId: null,
                }
            });
        }

        await tx.customerAccountEntry.deleteMany({
            where: {
                referenceType: "SALE_INVOICE",
                referenceId: invoiceId
            }
        });

        // 5. Update invoice header
        await tx.invoice.update({
            where: { id: invoiceId },
            data: {
                note: note !== undefined ? note || null : undefined,
                dueDate: dueDate !== undefined ? dueDate || null : undefined,
                totalAmount,
            },
        });

        // 6. Create new lines + stock movements (same as create flow)
        const createdLines = [];
        for (const line of lines) {
            const lineTotal = computeLineTotal(line.quantity, line.unitAmount);
            const part =
                line.lineType === "INVENTORY" && line.partId
                    ? partMap.get(line.partId)!
                    : null;

            const invoiceLine = await tx.invoiceLine.create({
                data: {
                    invoiceId,
                    partId: line.partId || null,
                    serviceId: line.serviceId || null,
                    lineType: line.lineType as InvoiceLineType,
                    description: line.description,
                    quantity: line.quantity,
                    unitAmount: line.unitAmount,
                    lineTotal,
                    costSnapshot: part?.costPrice != null ? part.costPrice : null,
                    createdById: actorId,
                    occurredAt: existing.issueDate,
                },
            });
            createdLines.push(invoiceLine);

            if (line.lineType === "INVENTORY" && line.partId) {
                const updated = await tx.part.updateMany({
                    where: {
                        id: line.partId,
                        stockQty: { gte: line.quantity },
                    },
                    data: {
                        stockQty: { decrement: line.quantity },
                    },
                });

                if (updated.count === 0) {
                    throw new ApiError(
                        400,
                        "INSUFFICIENT_STOCK",
                        `Concurrent stock conflict for part "${part!.name}". Try again.`
                    );
                }

                await tx.stockMovement.create({
                    data: {
                        partId: line.partId,
                        type: StockMovementType.SALE,
                        quantity: line.quantity,
                        occurredAt: existing.issueDate,
                        note: `Sale invoice ${existing.number} (updated)`,
                        createdById: actorId,
                        invoiceId,
                    },
                });
            }
        }

        // 7. Create new aggregate transaction
        const transaction = await tx.transaction.create({
            data: {
                type: TransactionType.INCOME,
                incomeSource: IncomeSource.INVOICE,
                itemName: `Invoice ${existing.number}`,
                unitPrice: totalAmount,
                quantity: 1,
                amount: totalAmount,
                sellPriceAtTimeOfSale: totalAmount,
                costAtTimeOfSale: avgUnitCost,
                costTotal: totalCost,
                profitAmount,
                note: note || `Sale invoice ${existing.number}`,
                description: `Sale invoice ${existing.number}`,
                invoiceId,
                referenceType: "INVOICE",
                referenceId: invoiceId,
                occurredAt: existing.issueDate,
                recordedAt: new Date(),
                createdById: actorId,
                updatedById: actorId,
            },
        });

        let ledgerEntry = null;
        if (customerIdForLedger) {
            ledgerEntry = await tx.customerAccountEntry.create({
                data: {
                    customerId: customerIdForLedger,
                    type: CustomerAccountEntryType.CHARGE,
                    amount: totalAmount,
                    occurredAt: existing.issueDate,
                    note: note || `Sale invoice ${existing.number}`,
                    createdByAdminId: actorId,
                    referenceType: "SALE_INVOICE",
                    referenceId: invoiceId
                }
            });
        }

        return {
            invoice: { ...existing, note, totalAmount },
            lines: createdLines,
            transaction,
            ledgerEntry
        };
    });

    return result;
}

// ── Void Sale Invoice ──────────────────────────────────────────────────

export async function voidSaleInvoice(invoiceId: string, actorId: string) {
    const existing = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
            invoiceLines: true,
            transaction: true,
        },
    });

    if (!existing) {
        throw new ApiError(404, "INVOICE_NOT_FOUND", "Invoice not found.");
    }
    if (existing.type !== InvoiceType.SALE) {
        throw new ApiError(
            400,
            "NOT_SALE_INVOICE",
            "Only SALE invoices can be voided via this endpoint."
        );
    }
    if (existing.status === InvoiceStatus.VOID) {
        throw new ApiError(400, "ALREADY_VOIDED", "Invoice is already voided.");
    }

    // Compute stock to restore
    const deductions = new Map<string, number>();
    for (const line of existing.invoiceLines) {
        if (line.lineType === "INVENTORY" && line.partId) {
            deductions.set(
                line.partId,
                (deductions.get(line.partId) || 0) + line.quantity
            );
        }
    }

    await prisma.$transaction(async (tx) => {
        await lockPartsForUpdate(tx, Array.from(deductions.keys()));
        // Restore stock
        for (const [partId, qty] of deductions) {
            await tx.part.update({
                where: { id: partId },
                data: { stockQty: { increment: qty } },
            });
        }

        // Delete stock movements
        await tx.stockMovement.deleteMany({
            where: { invoiceId },
        });

        // Soft-delete transaction
        if (existing.transaction) {
            await tx.transaction.update({
                where: { id: existing.transaction.id },
                data: {
                    deletedAt: new Date(),
                    deletedById: actorId,
                    updatedById: actorId,
                    invoiceId: null,
                }
            });
        }

        const chargeEntries = await tx.customerAccountEntry.findMany({
            where: {
                referenceType: "SALE_INVOICE",
                referenceId: invoiceId,
                type: CustomerAccountEntryType.CHARGE
            },
            select: {
                customerId: true,
                amount: true
            }
        });
        for (const chargeEntry of chargeEntries) {
            await tx.customerAccountEntry.create({
                data: {
                    customerId: chargeEntry.customerId,
                    type: CustomerAccountEntryType.ADJUSTMENT,
                    amount: -Math.abs(Number(chargeEntry.amount)),
                    occurredAt: new Date(),
                    note: `Reversal for voided invoice ${existing.number}`,
                    createdByAdminId: actorId,
                    referenceType: "SALE_INVOICE_VOID",
                    referenceId: invoiceId
                }
            });
        }

        // Mark invoice as VOID
        await tx.invoice.update({
            where: { id: invoiceId },
            data: { status: InvoiceStatus.VOID },
        });
    });

    return { invoiceId, status: "VOID" };
}


