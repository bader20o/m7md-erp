import Link from "next/link";
import { CreateBookingForm } from "@/components/bookings/create-booking-form";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ locale: string }> };

export default async function NewBookingPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const session = await getSession();
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" }
  });

  if (!session) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        {locale === "ar" ? "يرجى تسجيل الدخول أولاً." : "Please login first."}{" "}
        <Link href={`/${locale}/login`} className="font-medium underline">
          {locale === "ar" ? "تسجيل الدخول" : "Login"}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">{locale === "ar" ? "حجز موعد" : "Book a Service"}</h1>
      <CreateBookingForm locale={locale} services={services} />
    </div>
  );
}
