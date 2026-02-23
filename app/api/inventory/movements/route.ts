import { Prisma, Role, StockMovementType } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import {
  canOverrideNegativeStock,
  computeStockQty,
  isStockChangeAllowed,
  resolveStockDelta
} from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { createMovementSchema, listMovementsQuerySchema } from "@/lib/validators/inventory";

export async function GET(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
    const url = new URL(request.url);
    const query = await listMovementsQuerySchema.parseAsync({
      partId: url.searchParams.get("partId") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      take: url.searchParams.get("take") ?? undefined
    });

    const items = await prisma.stockMovement.findMany({
      where: {
        partId: query.partId,
        occurredAt:
          query.from || query.to
            ? {
                gte: query.from ?? undefined,
                lte: query.to ?? undefined
              }
            : undefined
      },
      include: {
        part: true,
        createdBy: { select: { id: true, fullName: true, phone: true, role: true } },
        supplier: { select: { id: true, name: true } },
        invoice: { select: { id: true, number: true } },
        booking: { select: { id: true, status: true } }
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: query.take
    });

    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
    const body = await parseJsonBody(request, createMovementSchema);

    if (body.type === "ADJUST" && !body.adjustDirection) {
      throw new ApiError(400, "ADJUST_DIRECTION_REQUIRED", "adjustDirection is required for ADJUST type.");
    }

    const [booking, supplier, invoice] = await Promise.all([
      body.bookingId
        ? prisma.booking.findUnique({ where: { id: body.bookingId }, select: { id: true } })
        : Promise.resolve(null),
      body.supplierId
        ? prisma.supplier.findUnique({ where: { id: body.supplierId }, select: { id: true } })
        : Promise.resolve(null),
      body.invoiceId
        ? prisma.invoice.findUnique({ where: { id: body.invoiceId }, select: { id: true } })
        : Promise.resolve(null)
    ]);

    if (body.bookingId && !booking) {
      throw new ApiError(400, "INVALID_BOOKING", "bookingId must reference an existing booking.");
    }
    if (body.supplierId && !supplier) {
      throw new ApiError(400, "INVALID_SUPPLIER", "supplierId must reference an existing supplier.");
    }
    if (body.invoiceId && !invoice) {
      throw new ApiError(400, "INVALID_INVOICE", "invoiceId must reference an existing invoice.");
    }

    const delta = resolveStockDelta(
      body.type as StockMovementType,
      body.quantity,
      body.adjustDirection
    );

    const item = await prisma.$transaction(async (tx) => {
      const currentPart = await tx.part.findUnique({
        where: { id: body.partId },
        select: { id: true, isActive: true, stockQty: true }
      });
      if (!currentPart) {
        throw new ApiError(404, "PART_NOT_FOUND", "Part not found.");
      }
      if (!currentPart.isActive) {
        throw new ApiError(400, "PART_INACTIVE", "Part is inactive.");
      }

      const nextQty = computeStockQty(currentPart.stockQty, delta);
      if (!isStockChangeAllowed(currentPart.stockQty, delta, actor.role)) {
        throw new ApiError(400, "NEGATIVE_STOCK_NOT_ALLOWED", "Stock cannot become negative.");
      }

      if (delta < 0 && !canOverrideNegativeStock(actor.role)) {
        const reduced = await tx.part.updateMany({
          where: {
            id: body.partId,
            stockQty: { gte: Math.abs(delta) }
          },
          data: {
            stockQty: { decrement: Math.abs(delta) }
          }
        });
        if (reduced.count === 0) {
          throw new ApiError(400, "NEGATIVE_STOCK_NOT_ALLOWED", "Stock cannot become negative.");
        }
      } else {
        await tx.part.update({
          where: { id: body.partId },
          data: { stockQty: { increment: delta } }
        });
      }

      const note =
        body.type === "ADJUST"
          ? `[${body.adjustDirection}]${body.note ? ` ${body.note}` : ""}`
          : body.note;

      return tx.stockMovement.create({
        data: {
          partId: body.partId,
          type: body.type,
          quantity: body.quantity,
          occurredAt: body.occurredAt,
          note,
          createdById: actor.sub,
          bookingId: body.bookingId,
          supplierId: body.supplierId,
          invoiceId: body.invoiceId
        },
        include: {
          part: true,
          createdBy: { select: { id: true, fullName: true, phone: true, role: true } },
          supplier: { select: { id: true, name: true } },
          invoice: { select: { id: true, number: true } },
          booking: { select: { id: true, status: true } }
        }
      });
    });

    return ok({ item }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return fail(new ApiError(400, "INVALID_RELATION", "One of the linked entities does not exist."));
    }
    return fail(error);
  }
}

