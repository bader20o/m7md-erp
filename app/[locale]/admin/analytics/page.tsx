import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { AdminAnalyticsPage } from "@/components/admin/admin-analytics-page";
import { getSession } from "@/lib/auth";
import { getDictionary, getDirection } from "@/lib/i18n";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminAnalyticsRoutePage({ params }: Props): Promise<React.ReactElement> {
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

  return (
    <AdminAnalyticsPage
      locale={locale}
      dir={getDirection(locale)}
      dict={getDictionary(locale)}
    />
  );
}

