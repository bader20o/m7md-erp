import { InvoiceType, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
    beginIdempotency,
    finalizeIdempotencyFailure,
    finalizeIdempotencySuccess
} from "@/lib/idempotency";
import { prisma } from "@/lib/prisma";
import { hasPermission, requireRoles } from "@/lib/rbac";
import { createSaleInvoice } from "@/lib/invoice-integration";
import { createSaleInvoiceSchema } from "@/lib/validators/accounting";

/**
 * GET /api/accounting/sale-invoices
 * List all SALE invoices with lines and stock movements.
 */
export async function GET(): Promise<Response> {
    try {
        requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);

        const items = await prisma.invoice.findMany({
            where: { type: InvoiceType.SALE },
            include: {
                invoiceLines: {
                    include: {
                        part: { select: { id: true, name: true, sku: true, unit: true } },
                        service: { select: { id: true, nameEn: true, nameAr: true } }
                    },
                    orderBy: { createdAt: "asc" }
                },
                stockMovements: {
                    include: {
                        part: { select: { id: true, name: true } }
                    }
                },
                transaction: true
            },
            orderBy: { issueDate: "desc" },
            take: 200
        });

        return ok({ items });
    } catch (error) {
        return fail(error);
    }
}

/**
 * POST /api/accounting/sale-invoices
 * Create a new sale invoice with atomic stock + accounting integration.
 */
export async function POST(request: Request): Promise<Response> {
    let idempotencyState: Awaited<ReturnType<typeof beginIdempotency>>["state"] = null;
    try {
        const actor = requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
        const body = await parseJsonBody(request, createSaleInvoiceSchema);
        const idempotency = await beginIdempotency({
            request,
            actorId: actor.sub,
            payload: body
        });
        idempotencyState = idempotency.state;
        if (idempotency.replayResponse) {
            return idempotency.replayResponse;
        }

        const canEditInventoryPrice =
            actor.role === Role.ADMIN ||
            (actor.role === Role.EMPLOYEE && (await hasPermission(actor.sub, actor.role, "accounting")));

        const requestedLines = body.lines.map((l) => ({
            partId: l.partId ?? null,
            serviceId: l.serviceId ?? null,
            lineType: l.lineType,
            description: l.description,
            quantity: l.quantity,
            unitAmount: l.unitAmount
        }));

        let normalizedLines = requestedLines;
        if (!canEditInventoryPrice) {
            const partIds = Array.from(
                new Set(
                    requestedLines
                        .filter((line) => line.lineType === "INVENTORY" && line.partId)
                        .map((line) => line.partId as string)
                )
            );
            const parts = partIds.length
                ? await prisma.part.findMany({
                    where: { id: { in: partIds } },
                    select: { id: true, sellPrice: true }
                })
                : [];
            const partPriceMap = new Map(parts.map((item) => [item.id, Number(item.sellPrice ?? 0)]));
            normalizedLines = requestedLines.map((line) => {
                if (line.lineType !== "INVENTORY" || !line.partId) return line;
                return {
                    ...line,
                    unitAmount: partPriceMap.get(line.partId) ?? line.unitAmount
                };
            });
        }

        const result = await createSaleInvoice(
            {
            number: body.number,
            note: body.note,
            dueDate: body.dueDate,
            issueDate: body.issueDate,
            customerId: body.customerId,
            lines: normalizedLines
            },
            actor.sub
        );

        await logAudit({
            action: "SALE_INVOICE_CREATE",
            entity: "Invoice",
            entityId: result.invoice.id,
            actorId: actor.sub,
            payload: {
                number: result.invoice.number,
                totalAmount: result.invoice.totalAmount,
                lineCount: result.lines.length
            }
        });

        const responsePayload = { success: true, data: { item: result } };
        await finalizeIdempotencySuccess(idempotencyState, responsePayload, 201);
        return NextResponse.json(responsePayload, { status: 201 });
    } catch (error) {
        await finalizeIdempotencyFailure(idempotencyState, error);
        return fail(error);
    }
}
