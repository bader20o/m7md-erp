import { redirect } from "next/navigation";
import { AdminEmployeeAttendanceDetail } from "@/components/attendance/admin-employee-attendance-detail";
import { requireAttendanceAdmin } from "@/lib/attendance";
import { getSession } from "@/lib/auth";
import { env } from "@/lib/env";

type Props = {
  params: Promise<{ locale: string; employeeId: string }>;
};

export default async function AdminEmployeeAttendancePage({ params }: Props): Promise<React.ReactElement> {
  const { locale, employeeId } = await params;
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

  return (
    <AdminEmployeeAttendanceDetail
      locale={locale}
      timezone={env.ATTENDANCE_TIMEZONE}
      employeeId={employeeId}
    />
  );
}
