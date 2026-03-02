import { ServicesCatalog } from "@/components/services/services-catalog";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ locale: string }> };

export default async function ServicesPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  let services: Awaited<ReturnType<typeof prisma.service.findMany>> = [];
  let servicesLoadFailed = false;

  try {
    services = await prisma.service.findMany({
      where: { isActive: true },
      include: { _count: { select: { bookings: true } } },
      orderBy: { createdAt: "desc" }
    });
  } catch {
    servicesLoadFailed = true;
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[28px] border border-sky-100 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(225,241,255,0.9))] p-6 shadow-[0_24px_80px_-36px_rgba(17,94,169,0.45)] md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-700">Workshop services</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950 md:text-4xl">
          {locale === "ar" ? "الخدمات" : "Services"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
          {locale === "ar"
            ? "اختر الخدمة المناسبة لمركبتك، وسيتم تأكيد السعر النهائي بعد مراجعة الإدارة."
            : "Choose the service that fits your vehicle. Final pricing is reviewed and confirmed by admin after inspection."}
        </p>
      </section>

      {servicesLoadFailed ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {locale === "ar"
            ? "تعذر تحميل الخدمات حالياً. تحقق من إعدادات قاعدة البيانات ثم أعد المحاولة."
            : "Could not load services right now. Check database settings and try again."}
        </div>
      ) : (
        <ServicesCatalog locale={locale} services={services} />
      )}
    </div>
  );
}
