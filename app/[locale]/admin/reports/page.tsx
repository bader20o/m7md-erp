import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminReportsPage({ params }: Props): Promise<never> {
  const { locale } = await params;
  redirect(`/${locale}/admin/reports/analytics`);
}

