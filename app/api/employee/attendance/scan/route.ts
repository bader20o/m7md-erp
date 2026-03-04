import { fail, ok, parseJsonBody } from "@/lib/api";
import {
  recordAttendanceScan,
  requireAttendanceEmployee,
  resolveAttendanceRequestIp
} from "@/lib/attendance";
import { getSession } from "@/lib/auth";
import { attendanceScanRequestSchema } from "@/lib/validators/attendance";

export async function POST(request: Request): Promise<Response> {
  try {
    const { employee } = await requireAttendanceEmployee(await getSession());
    const body = await parseJsonBody(request, attendanceScanRequestSchema);
    const result = await recordAttendanceScan({
      employeeId: employee.id,
      qrText: body.qrText,
      ipAddress: resolveAttendanceRequestIp(request),
      userAgent: request.headers.get("user-agent")
    });

    return ok({
      ok: result.ok,
      status: result.status,
      message: result.message,
      event: {
        ...result.event,
        occurredAt: result.event.occurredAt.toISOString()
      }
    });
  } catch (error) {
    return fail(error);
  }
}
