import { BookingStatus } from "@prisma/client";
import { BookingStatusActions } from "@/components/admin/booking-status-actions";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ locale: string }> };

const statusColor: Record<BookingStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  APPROVED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-700",
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
        linkedEmployee: { include: { user: true } },
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
          <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">
                  {item.customer.fullName || item.customer.phone} -{" "}
                  {locale === "ar" ? item.service.nameAr : item.service.nameEn}
                </h2>
                <p className="text-sm text-slate-600">{item.appointmentAt.toLocaleString()}</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColor[item.status]}`}>
                {item.status}
              </span>
            </div>
            {item.finalPrice ? (
              <p className="mt-2 text-xs text-slate-600">Final Price: ${item.finalPrice.toString()}</p>
            ) : null}
            {item.rejectReason ? <p className="mt-1 text-xs text-red-700">Reject Reason: {item.rejectReason}</p> : null}
            {item.adminInternalNote ? (
              <p className="mt-1 text-xs text-slate-600">Admin Note: {item.adminInternalNote}</p>
            ) : null}
            {item.linkedEmployee ? (
              <p className="mt-1 text-xs text-slate-600">
                Linked Employee: {item.linkedEmployee.user.fullName || item.linkedEmployee.user.phone}
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
            />
          </article>
        ))}
      </div>
    </section>
  );
}
