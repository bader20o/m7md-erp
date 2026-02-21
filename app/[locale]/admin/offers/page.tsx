import { OfferManager } from "@/components/admin/offer-manager";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminOffersPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const [offers, services] = await Promise.all([
    prisma.offer.findMany({
      include: { services: { include: { service: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.service.findMany({
      where: { isActive: true },
      select: { id: true, nameEn: true, nameAr: true },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const serializedOffers = offers.map((offer) => ({
    id: offer.id,
    titleEn: offer.titleEn,
    titleAr: offer.titleAr,
    descriptionEn: offer.descriptionEn,
    descriptionAr: offer.descriptionAr,
    imageUrl: offer.imageUrl,
    startsAt: offer.startsAt ? offer.startsAt.toISOString() : null,
    endsAt: offer.endsAt ? offer.endsAt.toISOString() : null,
    isActive: offer.isActive,
    serviceNames: offer.services.map((item) => item.service.nameEn)
  }));

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{locale === "ar" ? "العروض" : "Offers / Slider"}</h1>
      <OfferManager locale={locale} offers={serializedOffers} serviceOptions={services} />
    </section>
  );
}
