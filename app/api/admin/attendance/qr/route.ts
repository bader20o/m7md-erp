import QRCode from "qrcode";
import { fail, ok } from "@/lib/api";
import { getAttendanceQrCodes, isAttendanceIpRestricted, requireAttendanceAdmin } from "@/lib/attendance";
import { getSession } from "@/lib/auth";

export async function GET(): Promise<Response> {
  try {
    await requireAttendanceAdmin(await getSession());

    const qrCodes = getAttendanceQrCodes();
    const [checkInQrImage, checkOutQrImage] = await Promise.all([
      QRCode.toDataURL(qrCodes.checkIn.payload, {
        margin: 1,
        width: 240,
        color: {
          dark: "#E5EEF9",
          light: "#08101E"
        }
      }),
      QRCode.toDataURL(qrCodes.checkOut.payload, {
        margin: 1,
        width: 240,
        color: {
          dark: "#E5EEF9",
          light: "#08101E"
        }
      })
    ]);

    return ok({
      ipRestricted: isAttendanceIpRestricted(),
      refreshEverySeconds: qrCodes.checkIn.refreshEverySeconds,
      checkIn: {
        payload: qrCodes.checkIn.payload,
        expiresAt: qrCodes.checkIn.expiresAt,
        imageDataUrl: checkInQrImage
      },
      checkOut: {
        payload: qrCodes.checkOut.payload,
        expiresAt: qrCodes.checkOut.expiresAt,
        imageDataUrl: checkOutQrImage
      }
    });
  } catch (error) {
    return fail(error);
  }
}
