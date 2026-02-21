import crypto from "node:crypto";
import { Role } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { attendanceScanSchema } from "@/lib/validators/employee";

function verifyQrPayload(employeeId: string, payload: string, secret: string): boolean {
  const [payloadEmployeeId, stamp, signature] = payload.split(":");
  if (!payloadEmployeeId || !stamp || !signature || payloadEmployeeId !== employeeId) {
    return false;
  }

  const expected = crypto.createHmac("sha256", secret).update(`${payloadEmployeeId}:${stamp}`).digest("hex");
  if (expected !== signature) {
    return false;
  }

  const stampNumber = Number(stamp);
  if (!Number.isFinite(stampNumber)) {
    return false;
  }

  const fiveMinutesMs = 5 * 60 * 1000;
  return Math.abs(Date.now() - stampNumber) <= fiveMinutesMs;
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.EMPLOYEE, Role.RECEPTION, Role.MANAGER, Role.ADMIN]);
    const body = await parseJsonBody(request, attendanceScanSchema);

    const employee = await prisma.employee.findUnique({
      where: { id: body.employeeId },
      select: { id: true, qrSecret: true }
    });
    if (!employee) {
      throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
    }

    const isValid = verifyQrPayload(employee.id, body.qrPayload, employee.qrSecret);
    if (!isValid) {
      throw new ApiError(400, "INVALID_QR", "Invalid or expired QR payload.");
    }

    const openAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        checkOutAt: null
      },
      orderBy: { checkInAt: "desc" }
    });

    if (openAttendance) {
      const item = await prisma.attendance.update({
        where: { id: openAttendance.id },
        data: { checkOutAt: new Date() }
      });
      return ok({ item, mode: "CHECK_OUT" });
    }

    const item = await prisma.attendance.create({
      data: {
        employeeId: employee.id,
        qrPayload: body.qrPayload
      }
    });

    return ok({ item, mode: "CHECK_IN" }, 201);
  } catch (error) {
    return fail(error);
  }
}

