import Link from "next/link";
import { BookingStatus } from "@prisma/client";
import { CustomerBookingActions } from "@/components/bookings/customer-booking-actions";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ locale: string }> };

const statusClass: Record<BookingStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  APPROVED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-700",
  COMPLETED: "bg-green-100 text-green-700",
  NO_SHOW: "bg-purple-100 text-purple-700"
};

export default async function MyBookingsPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        {locale === "ar" ? "يرجى تسجيل الدخول لعرض الحجوزات." : "Please login to view your bookings."}{" "}
        <Link href={`/${locale}/login`} className="font-medium underline">
          {locale === "ar" ? "تسجيل الدخول" : "Login"}
        </Link>
      </div>
    );
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
      <h1 className="text-2xl font-semibold">{locale === "ar" ? "حجوزاتي" : "My Bookings"}</h1>
      <div className="grid gap-3">
        {bookings.map((booking) => (
          <article key={booking.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">
                  {locale === "ar" ? booking.service.nameAr : booking.service.nameEn}
                </h2>
                <p className="text-sm text-slate-600">{booking.appointmentAt.toLocaleString()}</p>
                {booking.finalPrice ? (
                  <p className="mt-1 text-sm text-brand-700">Final Price: ${booking.finalPrice.toString()}</p>
                ) : null}
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass[booking.status]}`}>
                {booking.status}
              </span>
            </div>
            {booking.assignments.length ? (
              <p className="mt-2 text-xs text-slate-600">
                Staff: {booking.assignments.map((item) => item.employee.user.fullName || item.employee.user.phone).join(", ")}
              </p>
            ) : null}
            {booking.rejectReason ? (
              <p className="mt-2 text-xs text-red-700">Rejection Reason: {booking.rejectReason}</p>
            ) : null}
            <CustomerBookingActions
              bookingId={booking.id}
              status={booking.status}
              hasReview={Boolean(booking.review)}
            />
          </article>
        ))}
      </div>
    </div>
  );
}
