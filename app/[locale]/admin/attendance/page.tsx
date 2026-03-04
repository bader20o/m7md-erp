import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { AdminAttendanceDashboard } from "@/components/attendance/admin-attendance-dashboard";
import { getFixedAttendancePayloads, requireAttendanceAdmin } from "@/lib/attendance";
import { getSession } from "@/lib/auth";
import { env } from "@/lib/env";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminAttendancePage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  try {
    await requireAttendanceAdmin(session);
  } catch {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Access denied. Admins and managers only.
      </div>
    );
  }

  const payloads = getFixedAttendancePayloads();
  const [checkInImageDataUrl, checkOutImageDataUrl] = await Promise.all([
    QRCode.toDataURL(payloads.checkIn, {
      margin: 1,
      width: 220,
      color: {
        dark: "#e2fff3",
        light: "#0f172a"
      }
    }),
    QRCode.toDataURL(payloads.checkOut, {
      margin: 1,
      width: 220,
      color: {
        dark: "#e2fff3",
        light: "#0f172a"
      }
    })
  ]);

  return (
    <AdminAttendanceDashboard
      locale={locale}
      timezone={env.ATTENDANCE_TIMEZONE}
      qrCards={[
        {
          label: "Check In",
          payload: payloads.checkIn,
          imageDataUrl: checkInImageDataUrl
        },
        {
          label: "Check Out",
          payload: payloads.checkOut,
          imageDataUrl: checkOutImageDataUrl
        }
      ]}
    />
  );
}
