import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ locale: string }> };

export default async function ServicesPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  let services: Awaited<ReturnType<typeof prisma.service.findMany>> = [];
  let servicesLoadFailed = false;

  try {
    services = await prisma.service.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" }
    });
  } catch {
    servicesLoadFailed = true;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{locale === "ar" ? "الخدمات" : "Services"}</h1>
      {servicesLoadFailed ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {locale === "ar"
            ? "تعذر تحميل الخدمات حالياً. تحقق من إعدادات قاعدة البيانات ثم أعد المحاولة."
            : "Could not load services right now. Check database settings and try again."}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <article key={service.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-semibold">{locale === "ar" ? service.nameAr : service.nameEn}</h3>
            <p className="mt-1 text-sm text-slate-600">
              {locale === "ar" ? service.descriptionAr : service.descriptionEn}
            </p>
            <p className="mt-3 text-sm font-medium text-brand-700">{service.durationMinutes} min</p>
            <p className="mt-1 text-xs text-slate-500">
              {locale === "ar" ? "السعر يحدد بعد الفحص" : "Price determined after inspection"}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
