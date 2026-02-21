import { ReviewModeration } from "@/components/admin/review-moderation";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminReviewsPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const reviews = await prisma.review.findMany({
    include: {
      customer: { select: { fullName: true, phone: true } },
      booking: { include: { service: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  const serialized = reviews.map((review) => ({
    id: review.id,
    status: review.status,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
    bookingId: review.bookingId,
    serviceName: review.booking.service.nameEn,
    customerName: review.customer.fullName || review.customer.phone
  }));

  return (
    <ReviewModeration locale={locale} reviews={serialized} />
  );
}
