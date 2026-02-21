import { WorkingHoursManager } from "@/components/admin/working-hours-manager";
import { prisma } from "@/lib/prisma";

export default async function AdminWorkingHoursPage(): Promise<React.ReactElement> {
  const items = await prisma.workingHour.findMany({
    orderBy: { dayOfWeek: "asc" }
  });

  const serialized = items.map((item) => ({
    dayOfWeek: item.dayOfWeek,
    openTime: item.openTime,
    closeTime: item.closeTime,
    isClosed: item.isClosed
  }));

  return (
    <WorkingHoursManager items={serialized} />
  );
}
