import crypto from "node:crypto";
import { Role } from "@prisma/client";
import { ApiError, fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

export async function GET(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.EMPLOYEE, Role.RECEPTION, Role.MANAGER, Role.ADMIN]);

    const url = new URL(request.url);
    const employeeId = url.searchParams.get("employeeId");
    if (!employeeId) {
      throw new ApiError(400, "MISSING_EMPLOYEE_ID", "employeeId is required.");
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, qrSecret: true }
    });
    if (!employee) {
      throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
    }

    const stamp = Date.now();
    const signature = crypto
      .createHmac("sha256", employee.qrSecret)
      .update(`${employee.id}:${stamp}`)
      .digest("hex");
    const payload = `${employee.id}:${stamp}:${signature}`;

    return ok({ payload });
  } catch (error) {
    return fail(error);
  }
}

