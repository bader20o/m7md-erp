import { InvoiceType, Role } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hasPermission, requireRoles } from "@/lib/rbac";
import { updateSaleInvoice, voidSaleInvoice } from "@/lib/invoice-integration";
import { updateSaleInvoiceSchema } from "@/lib/validators/accounting";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/accounting/sale-invoices/[id]
 * Fetch a single sale invoice with full details.
 */
export async function GET(
    _request: Request,
    { params }: RouteParams
): Promise<Response> {
    try {
        requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
        const { id } = await params;

        const item = await prisma.invoice.findUnique({
            where: { id },
            include: {
                invoiceLines: {
                    include: {
                        part: {
                            select: {
                                id: true,
                                name: true,
                                sku: true,
                                unit: true,
                                stockQty: true,
                                costPrice: true,
                                sellPrice: true
                            }
                        },
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
            }
        });

        if (!item) {
            throw new ApiError(404, "INVOICE_NOT_FOUND", "Invoice not found.");
        }
        if (item.type !== InvoiceType.SALE) {
            throw new ApiError(
                400,
                "NOT_SALE_INVOICE",
                "This endpoint only serves SALE invoices."
            );
        }

        return ok({ item });
    } catch (error) {
        return fail(error);
    }
}

/**
 * PUT /api/accounting/sale-invoices/[id]
 * Update an existing sale invoice (recomputes stock + accounting atomically).
 */
export async function PUT(
    request: Request,
    { params }: RouteParams
): Promise<Response> {
    try {
        const actor = requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
        const { id } = await params;
        const body = await parseJsonBody(request, updateSaleInvoiceSchema);
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

        const result = await updateSaleInvoice(
            id,
            {
                note: body.note,
                dueDate: body.dueDate,
                customerId: body.customerId,
                lines: normalizedLines
            },
            actor.sub
        );

        await logAudit({
            action: "SALE_INVOICE_UPDATE",
            entity: "Invoice",
            entityId: id,
            actorId: actor.sub,
            payload: {
                lineCount: result.lines.length,
                totalAmount: result.transaction.amount
            }
        });

        return ok({ item: result });
    } catch (error) {
        return fail(error);
    }
}

/**
 * DELETE /api/accounting/sale-invoices/[id]
 * Void a sale invoice — reverses stock and removes the accounting transaction.
 */
export async function DELETE(
    _request: Request,
    { params }: RouteParams
): Promise<Response> {
    try {
        const actor = requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
        const { id } = await params;

        const result = await voidSaleInvoice(id, actor.sub);

        await logAudit({
            action: "SALE_INVOICE_VOID",
            entity: "Invoice",
            entityId: id,
            actorId: actor.sub,
            payload: { status: result.status }
        });

        return ok({ item: result });
    } catch (error) {
        return fail(error);
    }
}
