import { SalaryManager } from "@/components/admin/salary-manager";
import { prisma } from "@/lib/prisma";

export default async function AdminSalariesPage(): Promise<React.ReactElement> {
  const [payments, employees] = await Promise.all([
    prisma.salaryPayment.findMany({
      include: {
        employee: { include: { user: { select: { fullName: true, phone: true } } } },
        recordedBy: { select: { fullName: true, phone: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 300
    }),
    prisma.employee.findMany({
      include: { user: { select: { fullName: true, phone: true } } },
      where: { isActive: true },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const employeeOptions = employees.map((employee) => ({
    id: employee.id,
    label: employee.user.fullName || employee.user.phone
  }));

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Salaries</h1>
      <SalaryManager employees={employeeOptions} />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Employee</th>
              <th className="px-3 py-2">Period</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Recorded By</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{payment.employee.user.fullName || payment.employee.user.phone}</td>
                <td className="px-3 py-2">
                  {payment.periodMonth}/{payment.periodYear}
                </td>
                <td className="px-3 py-2">${payment.amount.toString()}</td>
                <td className="px-3 py-2">{payment.status}</td>
                <td className="px-3 py-2">{payment.recordedBy?.fullName || payment.recordedBy?.phone || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
