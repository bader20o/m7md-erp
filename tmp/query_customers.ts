import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const customers = await p.user.findMany({ where: { role: "CUSTOMER" }, select: { phone: true, fullName: true }, take: 5 });
console.log("CUSTOMERS:", JSON.stringify(customers, null, 2));
process.exit(0);
