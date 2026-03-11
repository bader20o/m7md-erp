import { Role } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { generateVisitQrToken } from "@/lib/loyalty";
import { requireRoles } from "@/lib/rbac";
import QRCode from "qrcode";

export async function GET(): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ADMIN, Role.EMPLOYEE]);
    const tokenData = await generateVisitQrToken("MAIN");
    const qrDataUrl = await QRCode.toDataURL(tokenData.token, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 360
    });
    return ok({ ...tokenData, qrDataUrl });
  } catch (error) {
    return fail(error);
  }
}
