import { redirect } from "next/navigation";
import { EmployeeQrScanPage } from "@/components/attendance/employee-qr-scan-page";
import { requireAttendanceEmployee } from "@/lib/attendance";
import { getSession } from "@/lib/auth";
import { env } from "@/lib/env";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function EmployeeQrScanRoute({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  try {
    await requireAttendanceEmployee(session);
  } catch {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Access denied. Employees only.
      </div>
    );
  }

  return <EmployeeQrScanPage locale={locale} timezone={env.ATTENDANCE_TIMEZONE} />;
}
