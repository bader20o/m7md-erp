import { redirect } from "next/navigation";
import { CreateBookingForm } from "@/components/bookings/create-booking-form";
import { getSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ locale: string }> };

export default async function NewBookingPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const dict = getDictionary(locale);
  const session = await getSession();
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" }
  });

  if (!session) {
    redirect(`/${locale}/login`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">{dict.menuBookService}</h1>
      <CreateBookingForm locale={locale} services={services} />
    </div>
  );
}
