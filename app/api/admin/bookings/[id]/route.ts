import { BookingStatus, Role } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { assertBookingTransition } from "@/lib/booking-status";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

const patchBookingSchema = z.object({
    status: z.nativeEnum(BookingStatus),
    note: z.string().optional()
});

export async function GET(request: Request, context: Params): Promise<Response> {
    try {
        requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
        const { id } = await context.params;

        const booking = await prisma.booking.findUnique({
            where: { id },
            include: {
                customer: { select: { fullName: true, phone: true } },
                service: { select: { nameEn: true, basePrice: true, priceType: true } }
            }
        });

        if (!booking) {
            throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");
        }

        // Fetch the audit logs independently since it targets 'entityId' and isn't directly relational.
        const auditLogs = await prisma.auditLog.findMany({
            where: { entity: "Booking", entityId: id, action: "BOOKING_STATUS_CHANGE" },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                actor: { select: { fullName: true, role: true } }
            }
        });

        return ok({ item: { ...booking, auditLogs } });
    } catch (error) {
        return fail(error);
    }
}

export async function PATCH(request: Request, context: Params): Promise<Response> {
    try {
        const actor = requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
        const rawBody = await request.text();
        let parsedBody: unknown = {};
        if (rawBody) {
            try {
                parsedBody = JSON.parse(rawBody);
            } catch {
                throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.");
            }
        }
        const body = patchBookingSchema.parse(parsedBody);
        const { id } = await context.params;

        // Block COMPLETED via PATCH — must use POST /complete endpoint
        if (body.status === BookingStatus.COMPLETED) {
            throw new ApiError(400, "USE_COMPLETE_ENDPOINT", "To mark a booking as completed, use POST /api/admin/bookings/{id}/complete with finalPrice.");
        }

        const booking = await prisma.booking.findUnique({
            where: { id },
            select: { id: true, status: true }
        });

        if (!booking) {
            throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");
        }

        // Determine status transition logic
        assertBookingTransition(booking.status, body.status);

        // Apply data mapping specific to transitions that require it
        const updateData: any = { status: body.status };
        if (body.status === BookingStatus.APPROVED) {
            updateData.rejectReason = null;
            updateData.cancelReason = null;
            updateData.cancelledByUserId = null;
        }

        if (body.note && ['CANCELLED', 'LATE_CANCELLED'].includes(body.status)) {
            updateData.cancelReason = body.note;
            updateData.cancelledByUserId = actor.sub;
        } else if (body.note && body.status === 'REJECTED') {
            updateData.rejectReason = body.note;
        }

        const item = await prisma.booking.update({
            where: { id },
            data: updateData
        });

        // Create Audit Log
        await logAudit({
            action: "BOOKING_STATUS_CHANGE",
            entity: "Booking",
            entityId: item.id,
            actorId: actor.sub,
            payload: {
                from: booking.status,
                to: item.status,
                note: body.note
            }
        });

        return ok({ item });
    } catch (error) {
        return fail(error);
    }
}
