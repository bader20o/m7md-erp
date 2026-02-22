import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";
import { getSession } from "@/lib/auth";
import { getDictionary, getDirection } from "@/lib/i18n";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminAnalyticsPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const allowedRoles: Role[] = [Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT];
  if (!allowedRoles.includes(session.role)) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Access denied. You do not have permission to view analytics.
      </div>
    );
  }

  const dict = getDictionary(locale);
  const dir = getDirection(locale);

  return <AnalyticsDashboard locale={locale} dir={dir} dict={dict} />;
}

