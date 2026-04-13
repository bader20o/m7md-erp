import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { addDays, subDays } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding test data for the dashboard under the admin user...");

  const adminUser = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
  if (!adminUser) {
    throw new Error("No admin user found to associate data with.");
  }

  // 1. Create a dummy employee
  const employeePassword = await bcrypt.hash("Password123!", 10);
  const employeeUser = await prisma.user.upsert({
    where: { phone: "0791111111" },
    update: {},
    create: {
      phone: "0791111111",
      fullName: "Test Mechanic",
      passwordHash: employeePassword,
      role: Role.EMPLOYEE,
      isActive: true,
    }
  });
  
  const employee = await prisma.employee.upsert({
    where: { userId: employeeUser.id },
    update: {},
    create: {
      userId: employeeUser.id,
      nationalIdHash: "test-hash-" + Date.now(),
      nationalIdEncrypted: "enc",
      birthDateEncrypted: "enc",
      jobTitleEncrypted: "enc",
    }
  });

  // 2. Create a dummy customer + Car details on User model
  const customerPassword = await bcrypt.hash("Password123!", 10);
  const customer = await prisma.user.upsert({
    where: { phone: "0792222222" },
    update: {},
    create: {
      phone: "0792222222",
      fullName: "Test Customer",
      passwordHash: customerPassword,
      role: Role.CUSTOMER,
      carCompany: "Toyota",
      carModel: "Prius",
      carYear: "2018",
      licensePlate: "12-34567",
      isActive: true,
    }
  });

  // 3. Add debt to customer (CustomerAccountEntry)
  await prisma.customerAccountEntry.create({
    data: {
      customerId: customer.id,
      type: "CHARGE",
      amount: 150.0,
      createdByAdminId: adminUser.id,
      note: "Test Overdue Debt"
    }
  });

  // 4. Get some services
  const diagService = await prisma.service.findFirst({ where: { category: "Diagnostics" } });
  const batteryService = await prisma.service.findFirst({ where: { category: "Battery" } });

  if (!diagService || !batteryService) {
    throw new Error("Missing seeded services.");
  }

  // 5. Create Bookings for Today
  const today = new Date();
  
  // Completed Booking
  await prisma.booking.create({
    data: {
      customerId: customer.id,
      serviceId: diagService.id,
      appointmentAt: new Date(today.setHours(10, 0, 0, 0)),
      slotDate: new Date(today.setHours(10, 0, 0, 0)).toISOString().split('T')[0],
      slotTime: "10:00",
      status: "COMPLETED",
      completedAt: new Date(today.setHours(11, 30, 0, 0)),
      finalPrice: 120.0,
      serviceNameSnapshotEn: diagService.nameEn,
      serviceNameSnapshotAr: diagService.nameAr,
      performedByEmployeeId: employee.id,
    }
  });

  // Income Transaction
  await prisma.transaction.create({
    data: {
      type: "INCOME",
      amount: 120.0,
      incomeSource: "BOOKING",
      itemName: diagService.nameEn,
      occurredAt: new Date(today.setHours(11, 30, 0, 0))
    }
  });

  // Waiting Booking
  await prisma.booking.create({
    data: {
      customerId: customer.id,
      serviceId: batteryService.id,
      appointmentAt: new Date(today.setHours(today.getHours() - 1)), // 1 hour ago
      slotDate: new Date(today.setHours(today.getHours() - 1)).toISOString().split('T')[0],
      slotTime: "13:00",
      status: "PENDING", // PENDING acts as waiting
      serviceNameSnapshotEn: batteryService.nameEn,
      serviceNameSnapshotAr: batteryService.nameAr,
    }
  });

  // In Progress Booking
  await prisma.booking.create({
    data: {
      customerId: customer.id,
      serviceId: diagService.id,
      appointmentAt: new Date(today.setHours(14, 0, 0, 0)),
      slotDate: new Date(today.setHours(14, 0, 0, 0)).toISOString().split('T')[0],
      slotTime: "14:00",
      status: "APPROVED", // Approved acts as in progress / scheduled
      serviceNameSnapshotEn: "Oil Change",
      serviceNameSnapshotAr: "تغيير زيت",
      performedByEmployeeId: employee.id,
    }
  });

  // 6. Expiring Membership constraint (within 7 days)
  const expiringDate = addDays(new Date(), 3);
  const membershipPlan = await prisma.membershipPlan.findFirst();
  if (membershipPlan) {
    await prisma.membershipOrder.create({
      data: {
        customerId: customer.id,
        planId: membershipPlan.id,
        status: "ACTIVE",
        priceSnapshot: membershipPlan.price,
        startDate: subDays(new Date(), 177),
        endDate: expiringDate,
      }
    });
  }

  console.log("Test data seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
