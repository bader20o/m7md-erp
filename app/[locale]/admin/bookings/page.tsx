import { BookingStatus } from "@prisma/client";
import { BookingStatusActions } from "@/components/admin/booking-status-actions";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ locale: string }> };

const statusColor: Record<BookingStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  PRICE_SET: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-orange-100 text-orange-700",
  LATE_CANCELLED: "bg-orange-200 text-orange-800",
  NOT_SERVED: "bg-zinc-200 text-zinc-700",
  COMPLETED: "bg-green-100 text-green-700",
  NO_SHOW: "bg-purple-100 text-purple-700"
};

export default async function AdminBookingsPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const [items, employees] = await Promise.all([
    prisma.booking.findMany({
      include: {
        customer: true,
        service: true,
        performedByEmployee: { include: { user: true } },
        assignments: { include: { employee: { include: { user: true } } } }
      },
      orderBy: { appointmentAt: "desc" },
      take: 200
    }),
    prisma.employee.findMany({
      where: { isActive: true },
      include: { user: true }
    })
  ]);

  const employeeOptions = employees.map((employee) => ({
    id: employee.id,
    label: employee.user.fullName || employee.user.phone
  }));

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{locale === "ar" ? "إدارة الحجوزات" : "Admin Bookings"}</h1>
      <div className="grid gap-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-[24px] border border-sky-100 bg-white p-5 shadow-[0_20px_60px_-40px_rgba(17,94,169,0.45)]"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">
                  {item.customer.fullName || item.customer.phone} - {locale === "ar" ? item.service.nameAr : item.service.nameEn}
                </h2>
                <p className="text-sm text-slate-600">{item.appointmentAt.toLocaleString()}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor[item.status]}`}>{item.status}</span>
            </div>
            {item.finalPrice ? (
              <p className="mt-2 text-sm font-medium text-sky-700">Final Price: {item.finalPrice.toString()} JOD</p>
            ) : null}
            {item.status === BookingStatus.PENDING ? (
              <p className="mt-1 text-xs text-slate-500">Customer is waiting for admin pricing review.</p>
            ) : null}
            {item.status === BookingStatus.PRICE_SET ? (
              <p className="mt-1 text-xs text-amber-700">Customer has been notified and is still deciding.</p>
            ) : null}
            {item.rejectReason ? <p className="mt-1 text-xs text-red-700">Reject Reason: {item.rejectReason}</p> : null}
            {item.internalNote ? <p className="mt-1 text-xs text-slate-600">Admin Note: {item.internalNote}</p> : null}
            {item.performedByEmployee ? (
              <p className="mt-1 text-xs text-slate-600">
                Linked Employee: {item.performedByEmployee.user.fullName || item.performedByEmployee.user.phone}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-slate-600">
              Assigned:{" "}
              {item.assignments.length
                ? item.assignments.map((assignment) => assignment.employee.user.fullName || assignment.employee.user.phone).join(", ")
                : "None"}
            </p>
            <BookingStatusActions
              bookingId={item.id}
              status={item.status}
              employeeOptions={employeeOptions}
              existingFinalPrice={item.finalPrice?.toString() ?? null}
              existingInternalNote={item.internalNote}
            />
          </article>
        ))}
      </div>
    </section>
  );
}
