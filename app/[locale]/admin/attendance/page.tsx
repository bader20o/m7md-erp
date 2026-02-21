import { prisma } from "@/lib/prisma";

export default async function AdminAttendancePage(): Promise<React.ReactElement> {
  const attendance = await prisma.attendance.findMany({
    include: {
      employee: {
        include: {
          user: { select: { fullName: true, phone: true } }
        }
      }
    },
    orderBy: { checkInAt: "desc" },
    take: 300
  });

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Attendance</h1>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Employee</th>
              <th className="px-3 py-2">Check In</th>
              <th className="px-3 py-2">Check Out</th>
              <th className="px-3 py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {attendance.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{row.employee.user.fullName || row.employee.user.phone}</td>
                <td className="px-3 py-2">{row.checkInAt.toLocaleString()}</td>
                <td className="px-3 py-2">{row.checkOutAt ? row.checkOutAt.toLocaleString() : "-"}</td>
                <td className="px-3 py-2">{row.note || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
