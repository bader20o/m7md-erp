import bcrypt from "bcryptjs";
import { MembershipPlanTier, PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

const ROLE_PERMISSION_MAP: Record<Role, string[]> = {
  CUSTOMER: [],
  EMPLOYEE: ["attendance.own"],
  RECEPTION: ["bookings.walkin", "bookings.manage", "customers.manage", "attendance.manage", "ledger.write"],
  ACCOUNTANT: ["ledger.read", "ledger.write", "reports.read", "suppliers.manage", "invoices.manage", "salaries.manage"],
  MANAGER: [
    "bookings.manage",
    "bookings.walkin",
    "customers.manage",
    "reviews.moderate",
    "membership.manage",
    "attendance.manage",
    "salaries.manage",
    "services.manage",
    "offers.manage",
    "about.manage",
    "hours.manage",
    "ledger.read",
    "ledger.write",
    "reports.read",
    "suppliers.manage",
    "invoices.manage"
  ],
  ADMIN: [
    "bookings.manage",
    "bookings.walkin",
    "customers.manage",
    "reviews.moderate",
    "membership.manage",
    "membership.adjust",
    "users.manage",
    "attendance.own",
    "attendance.manage",
    "salaries.manage",
    "services.manage",
    "offers.manage",
    "about.manage",
    "hours.manage",
    "ledger.read",
    "ledger.write",
    "reports.read",
    "suppliers.manage",
    "invoices.manage",
    "audit.read",
    "backup.manage",
    "system.admin"
  ]
};

async function main(): Promise<void> {
  const adminPhone = process.env.DEFAULT_ADMIN_PHONE ?? "+15550000000";
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD ?? "ChangeMe123!";
  const adminName = process.env.DEFAULT_ADMIN_NAME ?? "System Admin";

  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { phone: adminPhone },
    update: {
      fullName: adminName,
      role: Role.ADMIN,
      passwordHash: adminPasswordHash,
      isActive: true
    },
    create: {
      phone: adminPhone,
      passwordHash: adminPasswordHash,
      fullName: adminName,
      role: Role.ADMIN,
      isActive: true
    }
  });

  const [diagnostics, battery, inverter] = await Promise.all([
    prisma.service.upsert({
      where: { id: "seed_service_diagnostics" },
      update: {
        category: "Diagnostics",
        basePrice: null,
        isActive: true
      },
      create: {
        id: "seed_service_diagnostics",
        nameEn: "Full EV Diagnostics",
        nameAr: "??? ???? ??????? ??????????",
        category: "Diagnostics",
        descriptionEn: "Battery and power electronics diagnostics.",
        descriptionAr: "??? ???????? ??????????? ??????.",
        durationMinutes: 60,
        basePrice: null,
        isActive: true
      }
    }),
    prisma.service.upsert({
      where: { id: "seed_service_battery_cooling" },
      update: {
        category: "Battery",
        basePrice: null,
        isActive: true
      },
      create: {
        id: "seed_service_battery_cooling",
        nameEn: "Battery Cooling Service",
        nameAr: "???? ????? ????????",
        category: "Battery",
        descriptionEn: "Cooling system flush and thermal checks.",
        descriptionAr: "????? ???? ??????? ???? ???????.",
        durationMinutes: 90,
        basePrice: null,
        isActive: true
      }
    }),
    prisma.service.upsert({
      where: { id: "seed_service_inverter" },
      update: {
        category: "Power Electronics",
        basePrice: null,
        isActive: true
      },
      create: {
        id: "seed_service_inverter",
        nameEn: "Inverter Inspection",
        nameAr: "??? ????????",
        category: "Power Electronics",
        descriptionEn: "Inverter health checks and preventive service.",
        descriptionAr: "??? ???? ???????? ???????? ????????.",
        durationMinutes: 75,
        basePrice: null,
        isActive: true
      }
    })
  ]);

  const [bronze, silver, gold] = await Promise.all([
    prisma.membershipPlan.upsert({
      where: { tier: MembershipPlanTier.BRONZE },
      update: {
        nameEn: "Bronze Care",
        nameAr: "?????? ?????????",
        descriptionEn: "Entry plan for periodic checks.",
        descriptionAr: "???? ?????? ???????? ???????.",
        price: 299,
        durationDays: 180,
        isActive: true
      },
      create: {
        tier: MembershipPlanTier.BRONZE,
        nameEn: "Bronze Care",
        nameAr: "?????? ?????????",
        descriptionEn: "Entry plan for periodic checks.",
        descriptionAr: "???? ?????? ???????? ???????.",
        price: 299,
        durationDays: 180,
        isActive: true
      }
    }),
    prisma.membershipPlan.upsert({
      where: { tier: MembershipPlanTier.SILVER },
      update: {
        nameEn: "Silver Care",
        nameAr: "?????? ??????",
        descriptionEn: "Balanced plan for regular EV maintenance.",
        descriptionAr: "???? ??????? ?????? ???????? ??????????.",
        price: 599,
        durationDays: 365,
        isActive: true
      },
      create: {
        tier: MembershipPlanTier.SILVER,
        nameEn: "Silver Care",
        nameAr: "?????? ??????",
        descriptionEn: "Balanced plan for regular EV maintenance.",
        descriptionAr: "???? ??????? ?????? ???????? ??????????.",
        price: 599,
        durationDays: 365,
        isActive: true
      }
    }),
    prisma.membershipPlan.upsert({
      where: { tier: MembershipPlanTier.GOLD },
      update: {
        nameEn: "Gold Care",
        nameAr: "?????? ???????",
        descriptionEn: "Premium plan with extended entitlements.",
        descriptionAr: "???? ?????? ?? ????? ??????? ?????.",
        price: 899,
        durationDays: 365,
        isActive: true
      },
      create: {
        tier: MembershipPlanTier.GOLD,
        nameEn: "Gold Care",
        nameAr: "?????? ???????",
        descriptionEn: "Premium plan with extended entitlements.",
        descriptionAr: "???? ?????? ?? ????? ??????? ?????.",
        price: 899,
        durationDays: 365,
        isActive: true
      }
    })
  ]);

  await prisma.membershipPlanService.deleteMany({
    where: {
      planId: { in: [bronze.id, silver.id, gold.id] }
    }
  });

  await prisma.membershipPlanService.createMany({
    data: [
      {
        planId: bronze.id,
        serviceId: diagnostics.id,
        totalUses: 2,
        preventDuplicatePerBooking: true
      },
      {
        planId: silver.id,
        serviceId: diagnostics.id,
        totalUses: 4,
        preventDuplicatePerBooking: true
      },
      {
        planId: silver.id,
        serviceId: battery.id,
        totalUses: 2,
        preventDuplicatePerBooking: true
      },
      {
        planId: gold.id,
        serviceId: diagnostics.id,
        totalUses: 6,
        preventDuplicatePerBooking: true
      },
      {
        planId: gold.id,
        serviceId: battery.id,
        totalUses: 4,
        preventDuplicatePerBooking: true
      },
      {
        planId: gold.id,
        serviceId: inverter.id,
        totalUses: 3,
        preventDuplicatePerBooking: true
      }
    ]
  });

  await prisma.rolePermission.deleteMany();
  await prisma.rolePermission.createMany({
    data: Object.entries(ROLE_PERMISSION_MAP).flatMap(([role, permissions]) =>
      permissions.map((permission) => ({
        role: role as Role,
        permission
      }))
    )
  });

  await prisma.systemSetting.upsert({
    where: { id: 1 },
    update: {
      cancellationPolicyHours: 24,
      lateCancellationHours: 2,
      defaultCurrency: "USD",
      timezone: "UTC"
    },
    create: {
      id: 1,
      cancellationPolicyHours: 24,
      lateCancellationHours: 2,
      defaultCurrency: "USD",
      timezone: "UTC"
    }
  });

  await prisma.aboutSettings.upsert({
    where: { id: 1 },
    update: {
      centerNameEn: "Mohammad Khwaileh Center",
      centerNameAr: "???? ???? ?????",
      descriptionEn: "Specialized maintenance for hybrid and electric vehicles.",
      descriptionAr: "????? ?????? ???????? ??????? ???????????.",
      phone: "+15551234567",
      mapEmbedUrl: "https://maps.google.com"
    },
    create: {
      id: 1,
      centerNameEn: "Mohammad Khwaileh Center",
      centerNameAr: "???? ???? ?????",
      descriptionEn: "Specialized maintenance for hybrid and electric vehicles.",
      descriptionAr: "????? ?????? ???????? ??????? ???????????.",
      phone: "+15551234567",
      mapEmbedUrl: "https://maps.google.com"
    }
  });

  for (let day = 0; day < 7; day += 1) {
    await prisma.workingHour.upsert({
      where: { dayOfWeek: day },
      update: {
        openTime: "09:00",
        closeTime: "18:00",
        isClosed: day === 5
      },
      create: {
        dayOfWeek: day,
        openTime: "09:00",
        closeTime: "18:00",
        isClosed: day === 5
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
