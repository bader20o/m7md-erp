import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminUsersPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 300
  });

  const roleCounts = Object.values(Role).reduce<Record<Role, number>>((acc, role) => {
    acc[role] = 0;
    return acc;
  }, {} as Record<Role, number>);

  for (const user of users) {
    roleCounts[user.role] += 1;
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{locale === "ar" ? "المستخدمون" : "Users"}</h1>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Object.values(Role).map((role) => (
          <article key={role} className="rounded-xl border border-slate-200 bg-white p-3">
            <h2 className="text-xs font-semibold text-slate-500">{role}</h2>
            <p className="mt-1 text-2xl font-bold text-brand-800">{roleCounts[role]}</p>
          </article>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Locale</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{user.fullName || "-"}</td>
                <td className="px-3 py-2">{user.phone}</td>
                <td className="px-3 py-2">{user.role}</td>
                <td className="px-3 py-2">{user.locale}</td>
                <td className="px-3 py-2">{user.isActive ? "Yes" : "No"}</td>
                <td className="px-3 py-2">{user.createdAt.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
