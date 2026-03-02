import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { AdminTasksBoard } from "@/components/tasks/admin-tasks-board";
import { getSession } from "@/lib/auth";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminTasksPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  if (session.role !== Role.ADMIN) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Access denied. Admin only.
      </div>
    );
  }

  return <AdminTasksBoard locale={locale} />;
}
