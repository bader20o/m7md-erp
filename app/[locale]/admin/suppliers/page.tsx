import { SupplierManager } from "@/components/admin/supplier-manager";
import { prisma } from "@/lib/prisma";

export default async function AdminSuppliersPage(): Promise<React.ReactElement> {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" }
  });

  const serialized = suppliers.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    createdAt: supplier.createdAt.toISOString()
  }));

  return (
    <SupplierManager suppliers={serialized} />
  );
}
