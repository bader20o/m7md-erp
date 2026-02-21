import { Role } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { assignBookingEmployeeSchema } from "@/lib/validators/booking";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Params): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.RECEPTION, Role.MANAGER, Role.ADMIN]);
    const body = await parseJsonBody(request, assignBookingEmployeeSchema);
    const { id } = await context.params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!booking) {
      throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");
    }

    const employee = await prisma.employee.findUnique({
      where: { id: body.employeeId },
      select: { id: true }
    });
    if (!employee) {
      throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
    }

    const assignment = await prisma.bookingServiceAssignment.create({
      data: {
        bookingId: id,
        employeeId: body.employeeId,
        serviceId: body.serviceId,
        note: body.note
      }
    });

    return ok({ item: assignment }, 201);
  } catch (error) {
    return fail(error);
  }
}

