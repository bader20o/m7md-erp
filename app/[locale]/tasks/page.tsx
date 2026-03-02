import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { EmployeeTasksBoard } from "@/components/tasks/employee-tasks-board";
import { getSession } from "@/lib/auth";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function TasksPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  if (session.role === Role.ADMIN) {
    redirect(`/${locale}/admin/tasks`);
  }

  if (session.role !== Role.EMPLOYEE) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Access denied. Employees only.
      </div>
    );
  }

  return <EmployeeTasksBoard locale={locale} />;
}
