import { ServiceManager } from "@/components/admin/service-manager";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminServicesPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const services = await prisma.service.findMany({
    orderBy: { createdAt: "desc" }
  });

  const serialized = services.map((service) => ({
    id: service.id,
    nameEn: service.nameEn,
    nameAr: service.nameAr,
    descriptionEn: service.descriptionEn,
    descriptionAr: service.descriptionAr,
    durationMinutes: service.durationMinutes,
    isActive: service.isActive
  }));

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{locale === "ar" ? "الخدمات" : "Services"}</h1>
      <ServiceManager locale={locale} services={serialized} />
    </section>
  );
}
