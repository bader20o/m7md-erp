import { redirect } from "next/navigation";
import { BookingStatus } from "@prisma/client";
import { CustomerBookingActions } from "@/components/bookings/customer-booking-actions";
import { getSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ locale: string }> };

const statusClass: Record<BookingStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  PRICE_SET: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-orange-100 text-orange-700",
  LATE_CANCELLED: "bg-orange-200 text-orange-800",
  NO_SHOW: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  NOT_SERVED: "bg-zinc-200 text-zinc-700"
};

export default async function MyBookingsPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const dict = getDictionary(locale);
  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const bookings = await prisma.booking.findMany({
    where: { customerId: session.sub },
    include: {
      service: true,
      review: { select: { id: true } },
      assignments: { include: { employee: { include: { user: true } } } }
    },
    orderBy: { appointmentAt: "desc" }
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{dict.menuMyBookings}</h1>
      <div className="grid gap-3">
        {bookings.map((booking) => (
          <article
            key={booking.id}
            className="rounded-[24px] border border-sky-100 bg-white p-5 shadow-[0_20px_60px_-40px_rgba(17,94,169,0.45)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{locale === "ar" ? booking.service.nameAr : booking.service.nameEn}</h2>
                <p className="text-sm text-slate-600">{booking.appointmentAt.toLocaleString()}</p>
                {booking.status === BookingStatus.PENDING ? (
                  <p className="mt-2 text-sm text-slate-500">Awaiting admin review</p>
                ) : null}
                {booking.finalPrice !== null ? (
                  <p className="mt-2 text-sm font-medium text-sky-700">Final Price: {booking.finalPrice.toString()} JOD</p>
                ) : null}
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass[booking.status]}`}>{booking.status}</span>
            </div>
            {booking.assignments.length ? (
              <p className="mt-2 text-xs text-slate-600">
                Staff: {booking.assignments.map((item) => item.employee.user.fullName || item.employee.user.phone).join(", ")}
              </p>
            ) : null}
            {booking.rejectReason ? <p className="mt-2 text-xs text-red-700">Rejection Reason: {booking.rejectReason}</p> : null}
            {booking.cancelReason ? <p className="mt-2 text-xs text-orange-700">Cancel Reason: {booking.cancelReason}</p> : null}
            <CustomerBookingActions
              bookingId={booking.id}
              status={booking.status}
              hasReview={Boolean(booking.review)}
              finalPrice={booking.finalPrice?.toString() ?? null}
              adminNote={booking.internalNote}
            />
          </article>
        ))}
      </div>
    </div>
  );
}
