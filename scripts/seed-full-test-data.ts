import {
  BookingStatus,
  CustomerAccountEntryType,
  EmployeePermission,
  EmployeeRoleProfile,
  EmploymentStatus,
  EmploymentType,
  ExpenseCategory,
  IncomeSource,
  Role,
  SalaryPaymentStatus,
  StockMovementType,
  TransactionType,
  UserStatus
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SEED_PREFIX = "seedfull";
const SEED_NOTE = "[seed-full-test-data]";
const TOTAL_CUSTOMERS = 30;
const TOTAL_DAYS = 90;

const rng = createSeededRandom(20260302);

const adminPhone = "0799900090";
const adminPassword = "Admin123!";

const SERVICE_CATALOG = [
  { code: "ev_diag", nameEn: "Full EV Diagnostics", nameAr: "فحص كهرباء شامل", category: "Diagnostics", basePrice: 55, durationMinutes: 60 },
  { code: "hybrid_scan", nameEn: "Hybrid Battery Health Scan", nameAr: "فحص بطارية هايبرد", category: "Battery", basePrice: 68, durationMinutes: 75 },
  { code: "ac_service", nameEn: "A/C Performance Service", nameAr: "صيانة تكييف", category: "Climate", basePrice: 28, durationMinutes: 45 },
  { code: "brake_service", nameEn: "Brake Service Package", nameAr: "خدمة فرامل", category: "Brakes", basePrice: 95, durationMinutes: 90 },
  { code: "alignment", nameEn: "Wheel Alignment", nameAr: "ميزان أذرعة", category: "Suspension", basePrice: 24, durationMinutes: 40 },
  { code: "cooling_flush", nameEn: "Battery Cooling Flush", nameAr: "غسيل تبريد البطارية", category: "Battery", basePrice: 84, durationMinutes: 90 },
  { code: "charger_port", nameEn: "Charge Port Cleaning", nameAr: "تنظيف منفذ الشحن", category: "Electrical", basePrice: 18, durationMinutes: 30 },
  { code: "regen_cal", nameEn: "Regenerative Brake Calibration", nameAr: "معايرة الفرامل الذكية", category: "Brakes", basePrice: 132, durationMinutes: 105 },
  { code: "inverter", nameEn: "Inverter Inspection", nameAr: "فحص الانفرتر", category: "Power Electronics", basePrice: 145, durationMinutes: 90 },
  { code: "dc_dc", nameEn: "DC-DC Converter Test", nameAr: "فحص محول كهربائي", category: "Power Electronics", basePrice: 118, durationMinutes: 80 },
  { code: "pump_replace", nameEn: "Cooling Pump Replacement", nameAr: "تبديل مضخة تبريد", category: "Cooling", basePrice: 220, durationMinutes: 120 },
  { code: "cell_balance", nameEn: "Battery Cell Balancing", nameAr: "موازنة خلايا البطارية", category: "Battery", basePrice: 275, durationMinutes: 150 }
] as const;

const SERVICE_DESCRIPTIONS = {
  ev_diag: {
    descriptionEn: "System-wide battery, charging, and power electronics diagnostics.",
    descriptionAr: "فحص شامل للبطارية ونظام الشحن والإلكترونيات."
  },
  hybrid_scan: {
    descriptionEn: "Capacity and cell-health scan for hybrid battery packs.",
    descriptionAr: "فحص سعة البطارية وحالة الخلايا للهايبرد."
  },
  ac_service: {
    descriptionEn: "Cooling efficiency check with cabin airflow and pressure testing.",
    descriptionAr: "فحص كفاءة التبريد وتدفق الهواء وضغط النظام."
  },
  brake_service: {
    descriptionEn: "Inspection, cleaning, and service for pads, discs, and brake response.",
    descriptionAr: "فحص وتنظيف وصيانة الفحمات والأقراص واستجابة الفرامل."
  },
  alignment: {
    descriptionEn: "Precision alignment to improve handling and reduce tire wear.",
    descriptionAr: "ضبط دقيق لزوايا العجلات لتحسين الثبات وتقليل اهتراء الإطارات."
  },
  cooling_flush: {
    descriptionEn: "Cooling circuit flush and thermal flow check for battery protection.",
    descriptionAr: "غسيل دائرة التبريد وفحص تدفق الحرارة لحماية البطارية."
  },
  charger_port: {
    descriptionEn: "Connector cleaning and contact inspection for reliable charging.",
    descriptionAr: "تنظيف المنفذ وفحص التوصيلات لشحن مستقر."
  },
  regen_cal: {
    descriptionEn: "Brake blending and regen response calibration for smoother stopping.",
    descriptionAr: "معايرة دمج الفرامل والكبح الاسترجاعي لتوقف أكثر سلاسة."
  },
  inverter: {
    descriptionEn: "Health check for inverter output, temperature, and fault signals.",
    descriptionAr: "فحص أداء الانفرتر وحرارته وإشارات الأعطال."
  },
  dc_dc: {
    descriptionEn: "Voltage conversion test to verify low-voltage system stability.",
    descriptionAr: "فحص تحويل الجهد للتأكد من استقرار النظام منخفض الجهد."
  },
  pump_replace: {
    descriptionEn: "Cooling pump replacement with system bleed and flow verification.",
    descriptionAr: "تبديل مضخة التبريد مع تنفيس النظام وفحص التدفق."
  },
  cell_balance: {
    descriptionEn: "Cell voltage balancing to improve pack consistency and performance.",
    descriptionAr: "موازنة جهد الخلايا لتحسين توازن الحزمة والأداء."
  }
} satisfies Record<string, { descriptionEn: string; descriptionAr: string }>;

const SUPPLIER_DATA = [
  { code: "volt", name: "Volt Parts Trading", phone: "065600111", address: "Sahab Industrial Zone" },
  { code: "green", name: "Green Motion Supplies", phone: "065600222", address: "Marka North" },
  { code: "eco", name: "EcoDrive Components", phone: "065600333", address: "Al Muqabalain" },
  { code: "smart", name: "Smart Garage Wholesale", phone: "065600444", address: "Bayader Wadi Al Seer" }
] as const;

const PART_DATA = [
  { code: "coolant", name: "Battery Coolant", category: "Fluids", unit: "liter", costPrice: 14, sellPrice: 23, threshold: 6, finalQty: 4, vehicleType: "EV", vehicleModel: "Universal" },
  { code: "filter", name: "Cabin Filter", category: "Filters", unit: "piece", costPrice: 8, sellPrice: 15, threshold: 5, finalQty: 18, vehicleType: "Hybrid", vehicleModel: "Prius" },
  { code: "pad_front", name: "Front Brake Pads", category: "Brakes", unit: "set", costPrice: 26, sellPrice: 46, threshold: 4, finalQty: 3, vehicleType: "Hybrid", vehicleModel: "Ioniq" },
  { code: "pad_rear", name: "Rear Brake Pads", category: "Brakes", unit: "set", costPrice: 22, sellPrice: 38, threshold: 4, finalQty: 11, vehicleType: "Hybrid", vehicleModel: "Corolla Cross" },
  { code: "pump", name: "Cooling Pump", category: "Cooling", unit: "piece", costPrice: 95, sellPrice: 145, threshold: 2, finalQty: 1, vehicleType: "EV", vehicleModel: "Model 3" },
  { code: "relay", name: "Main Relay", category: "Electrical", unit: "piece", costPrice: 34, sellPrice: 55, threshold: 3, finalQty: 8, vehicleType: "EV", vehicleModel: "Leaf" },
  { code: "port_cap", name: "Charge Port Cap", category: "Electrical", unit: "piece", costPrice: 9, sellPrice: 18, threshold: 5, finalQty: 14, vehicleType: "EV", vehicleModel: "Universal" },
  { code: "sensor", name: "Wheel Speed Sensor", category: "Sensors", unit: "piece", costPrice: 28, sellPrice: 49, threshold: 4, finalQty: 2, vehicleType: "Hybrid", vehicleModel: "Camry" },
  { code: "coil", name: "A/C Compressor Coil", category: "Climate", unit: "piece", costPrice: 72, sellPrice: 118, threshold: 2, finalQty: 5, vehicleType: "EV", vehicleModel: "Kona" },
  { code: "oil", name: "Gearbox Oil", category: "Fluids", unit: "liter", costPrice: 11, sellPrice: 19, threshold: 8, finalQty: 26, vehicleType: "Hybrid", vehicleModel: "Universal" },
  { code: "seal", name: "Battery Pack Seal Kit", category: "Battery", unit: "kit", costPrice: 32, sellPrice: 58, threshold: 3, finalQty: 7, vehicleType: "EV", vehicleModel: "Model Y" },
  { code: "module", name: "Control Module Fuse", category: "Electrical", unit: "piece", costPrice: 6, sellPrice: 14, threshold: 10, finalQty: 9, vehicleType: "EV", vehicleModel: "Universal" },
  { code: "hose", name: "Cooling Hose", category: "Cooling", unit: "piece", costPrice: 17, sellPrice: 29, threshold: 6, finalQty: 5, vehicleType: "Hybrid", vehicleModel: "Niro" },
  { code: "bush", name: "Suspension Bushing", category: "Suspension", unit: "piece", costPrice: 13, sellPrice: 25, threshold: 8, finalQty: 16, vehicleType: "Hybrid", vehicleModel: "RAV4" },
  { code: "bearing", name: "Wheel Bearing", category: "Suspension", unit: "piece", costPrice: 41, sellPrice: 72, threshold: 3, finalQty: 4, vehicleType: "Hybrid", vehicleModel: "ES300h" },
  { code: "wiper", name: "Premium Wiper Set", category: "Accessories", unit: "set", costPrice: 12, sellPrice: 22, threshold: 6, finalQty: 20, vehicleType: "Universal", vehicleModel: "Universal" },
  { code: "cleaner", name: "Battery Terminal Cleaner", category: "Chemicals", unit: "bottle", costPrice: 7, sellPrice: 13, threshold: 6, finalQty: 12, vehicleType: "EV", vehicleModel: "Universal" },
  { code: "grease", name: "Brake Grease", category: "Chemicals", unit: "tube", costPrice: 4, sellPrice: 9, threshold: 10, finalQty: 22, vehicleType: "Universal", vehicleModel: "Universal" },
  { code: "valve", name: "A/C Expansion Valve", category: "Climate", unit: "piece", costPrice: 39, sellPrice: 69, threshold: 2, finalQty: 1, vehicleType: "EV", vehicleModel: "Ioniq 5" },
  { code: "socket", name: "Fast Charge Socket Pin", category: "Electrical", unit: "piece", costPrice: 19, sellPrice: 35, threshold: 4, finalQty: 6, vehicleType: "EV", vehicleModel: "Universal" }
] as const;

const EMPLOYEE_DATA = [
  { code: "tech_01", fullName: "Ahmad Saleh Omar Haddad", phone: "0781000101", jobTitle: "Senior EV Technician", department: "Workshop", monthlyBase: 780, permissions: [EmployeePermission.BOOKINGS, EmployeePermission.WAREHOUSE] },
  { code: "tech_02", fullName: "Yousef Kareem Ali Nassar", phone: "0781000102", jobTitle: "Hybrid Systems Technician", department: "Workshop", monthlyBase: 720, permissions: [EmployeePermission.BOOKINGS] },
  { code: "advisor_01", fullName: "Dana Sami Noor Khoury", phone: "0781000103", jobTitle: "Service Advisor", department: "Front Desk", monthlyBase: 650, permissions: [EmployeePermission.BOOKINGS, EmployeePermission.ANALYTICS] },
  { code: "store_01", fullName: "Rana Issa Fadi Salem", phone: "0781000104", jobTitle: "Parts Coordinator", department: "Warehouse", monthlyBase: 610, permissions: [EmployeePermission.WAREHOUSE, EmployeePermission.ACCOUNTING] }
] as const;

const CUSTOMER_PROFILES = [
  ["Mohammad", "Haddad"], ["Lina", "Khoury"], ["Omar", "Azzam"], ["Haneen", "Nassar"], ["Khaled", "Saad"],
  ["Rami", "Mansour"], ["Maya", "Awad"], ["Tariq", "Najjar"], ["Sahar", "Salem"], ["Ali", "Masri"],
  ["Ahmad", "Shawabkeh"], ["Ruba", "Qudah"], ["Basil", "Hijazi"], ["Nadine", "Harb"], ["Mahmoud", "Atrash"],
  ["Razan", "Fakhouri"], ["Yousef", "Jaradat"], ["Farah", "Dabbas"], ["Faisal", "Bitar"], ["Muna", "Abu-Lail"],
  ["Sameer", "Khasawneh"], ["Jana", "Zyoud"], ["Alaa", "Hamdan"], ["Eman", "Hourani"], ["Zaid", "Obeidat"],
  ["Samer", "Malkawi"], ["Noor", "Tamimi"], ["Wael", "Hammouri"], ["Leen", "Sabbagh"], ["Hassan", "Banna"]
] as const;

const CAR_PROFILES = [
  ["Toyota", "Prius", "2017"], ["Hyundai", "Ioniq", "2020"], ["Tesla", "Model 3", "2021"], ["Kia", "Niro", "2019"],
  ["Nissan", "Leaf", "2018"], ["Lexus", "ES300h", "2022"], ["Toyota", "RAV4 Hybrid", "2023"], ["Hyundai", "Ioniq 5", "2024"],
  ["BYD", "Atto 3", "2024"], ["Mitsubishi", "Outlander PHEV", "2020"]
] as const;

const BOOKING_NOTES = [
  "Customer requested same-day inspection if slot opens.",
  "Battery warning light appeared during highway driving.",
  "Vehicle has vibration under regenerative braking.",
  "Check cooling circuit before long family trip.",
  "Customer asked for estimate before any extra work.",
  "Repeat visit after dashboard error returned.",
  "Needs fast turnaround; ride-share vehicle.",
  "Please test after charging session."
] as const;

const WALK_IN_ITEMS = [
  "Walk-in battery scan",
  "Walk-in software reset",
  "Walk-in quick A/C top-up",
  "Walk-in brake inspection",
  "Walk-in charging port clean"
] as const;

const GENERAL_EXPENSE_ITEMS = [
  "Workshop electricity bill",
  "Reception coffee and water",
  "Industrial cleaning supplies",
  "Waste disposal pickup",
  "Internet and cloud tools",
  "Compressed air maintenance",
  "Office stationery restock",
  "Customer shuttle fuel"
] as const;

type SeedUser = { id: string; fullName: string | null; phone: string };
type SeedEmployee = { id: string; userId: string; fullName: string; monthlyBase: number };
type SeedService = { id: string; code: string; nameEn: string; nameAr: string; category: string | null; basePrice: number; durationMinutes: number };
type SeedPart = { id: string; code: string; name: string; costPrice: number; sellPrice: number; lowStockThreshold: number; stockQty: number };
type SeedSupplier = { id: string; name: string };

const SEEDED_CUSTOMER_PHONES = Array.from({ length: TOTAL_CUSTOMERS }, (_, index) => seedCustomerPhone(index));

function seedCustomerPhone(index: number): string {
  return `07988${String(index + 1).padStart(5, "0")}`;
}

async function main(): Promise<void> {
  console.log("Seeding full admin test dataset...");

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.user.upsert({
    where: { phone: adminPhone },
    update: {
      fullName: "Full Test Seed Admin",
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      isActive: true,
      passwordHash
    },
    create: {
      id: `${SEED_PREFIX}_admin_user`,
      phone: adminPhone,
      passwordHash,
      fullName: "Full Test Seed Admin",
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      isActive: true
    }
  });

  await clearPreviousSeedData(admin.id);

  const now = new Date();
  const todayStart = atUtcDayStart(now);
  const dayStarts = Array.from({ length: TOTAL_DAYS }, (_, index) =>
    addDays(todayStart, -(TOTAL_DAYS - 1 - index))
  );
  const quietDayIndexes = new Set([5, 14, 22, 31, 43, 51, 64, 73, 82]);
  const activeDayIndexes = dayStarts.map((_, index) => index).filter((index) => !quietDayIndexes.has(index));

  const services = await seedServices();
  const suppliers = await seedSuppliers();
  const employees = await seedEmployees(admin.id);
  await seedAttendance(admin.id, employees, dayStarts);
  await seedSalaryPayments(admin.id, employees, todayStart);
  const customers = await seedCustomers(admin.id, dayStarts);
  const customerBalances = await seedCustomerLedger(admin.id, customers, dayStarts);
  const parts = await seedParts();

  const bookingStatuses = buildBookingStatusPool();
  shuffleInPlace(bookingStatuses);
  const bookingDayPlan = allocateBookingsAcrossDays(bookingStatuses.length, activeDayIndexes);
  const bookings: Array<{ id: string; appointmentAt: Date }> = [];

  for (let index = 0; index < bookingStatuses.length; index += 1) {
    const status = bookingStatuses[index];
    const dayIndex = bookingDayPlan[index];
    const dayStart = dayStarts[dayIndex];
    const service = weightedPick(services, [9, 8, 6, 5, 4, 5, 3, 3, 3, 2, 1, 1]);
    const customer = pickCustomer(customers, index);
    const appointmentAt = appointmentForDay(dayStart, service.durationMinutes, index);
    const quotePrice = variedPrice(service.basePrice, 0.14);
    const employee = weightedPick(employees, [5, 4, 3, 2]);
    const bookingId = `${SEED_PREFIX}_booking_${String(index + 1).padStart(3, "0")}`;

    const booking = await prisma.booking.create({
      data: {
        id: bookingId,
        customerId: customer.id,
        createdByUserId: admin.id,
        serviceId: service.id,
        branchId: "MAIN",
        slotDate: appointmentAt.toISOString().slice(0, 10),
        slotTime: appointmentAt.toISOString().slice(11, 16),
        appointmentAt,
        status,
        notes: `${SEED_NOTE} ${pickFrom(BOOKING_NOTES)}`,
        finalPrice: status === BookingStatus.COMPLETED ? quotePrice : null,
        internalNote:
          status === BookingStatus.COMPLETED
            ? `${SEED_NOTE} Completed after diagnostic confirmation`
            : status === BookingStatus.APPROVED
              ? `${SEED_NOTE} Quoted and waiting arrival`
              : null,
        performedByEmployeeId: status === BookingStatus.COMPLETED ? employee.id : null,
        serviceNameSnapshotEn: service.nameEn,
        serviceNameSnapshotAr: service.nameAr,
        serviceCategorySnapshot: service.category,
        serviceBasePriceSnapshot: service.basePrice,
        completedAt: status === BookingStatus.COMPLETED ? addHours(appointmentAt, 2) : null,
        createdAt: addHours(appointmentAt, -randomInt(8, 120))
      }
    });

    await createBookingAuditTrail({
      adminId: admin.id,
      bookingId: booking.id,
      appointmentAt,
      createdAt: booking.createdAt,
      finalStatus: status,
      finalPrice: status === BookingStatus.COMPLETED ? quotePrice : null,
      employeeId: status === BookingStatus.COMPLETED ? employee.id : null,
      index
    });

    if (status === BookingStatus.COMPLETED) {
      const occurredAt = addHours(appointmentAt, 2);
      await prisma.transaction.create({
        data: {
          id: `${SEED_PREFIX}_tx_booking_${String(index + 1).padStart(3, "0")}`,
          type: TransactionType.INCOME,
          incomeSource: IncomeSource.BOOKING,
          itemName: service.nameEn,
          unitPrice: quotePrice,
          quantity: 1,
          amount: quotePrice,
          costTotal: 0,
          profitAmount: quotePrice,
          note: `${SEED_NOTE} Completed booking income`,
          description: `Completed booking ${booking.id}`,
          bookingId: booking.id,
          referenceType: "BOOKING",
          referenceId: booking.id,
          occurredAt,
          recordedAt: occurredAt,
          createdById: admin.id
        }
      });
    }

    if (status === BookingStatus.NO_SHOW && index % 3 !== 0) {
      const penaltyAmount = round2(Math.max(8, quotePrice * (0.18 + (index % 4) * 0.04)));
      const occurredAt = addMinutes(appointmentAt, 35);
      await prisma.transaction.create({
        data: {
          id: `${SEED_PREFIX}_tx_penalty_${String(index + 1).padStart(3, "0")}`,
          type: TransactionType.INCOME,
          incomeSource: IncomeSource.BOOKING,
          itemName: `No-show penalty - ${service.nameEn}`,
          unitPrice: penaltyAmount,
          quantity: 1,
          amount: penaltyAmount,
          costTotal: 0,
          profitAmount: penaltyAmount,
          note: `${SEED_NOTE} No-show penalty`,
          description: `No-show penalty for booking ${booking.id}`,
          bookingId: booking.id,
          referenceType: "BOOKING_PENALTY",
          referenceId: booking.id,
          occurredAt,
          recordedAt: occurredAt,
          createdById: admin.id
        }
      });
    }

    if (status === BookingStatus.COMPLETED && index % 4 === 0) {
      const chargeAmount = round2(quotePrice * (index % 6 === 0 ? 1 : 0.45));
      const paymentAmount = round2(quotePrice * (index % 6 === 0 ? 0.55 : 0.45));
      await prisma.customerAccountEntry.createMany({
        data: [
          {
            id: `${SEED_PREFIX}_ledger_booking_charge_${String(index + 1).padStart(3, "0")}`,
            customerId: customer.id,
            type: CustomerAccountEntryType.CHARGE,
            amount: chargeAmount,
            occurredAt: addMinutes(appointmentAt, 40),
            note: `${SEED_NOTE} Booking charge for ${service.nameEn}`,
            createdByAdminId: admin.id,
            referenceType: "BOOKING",
            referenceId: booking.id
          },
          {
            id: `${SEED_PREFIX}_ledger_booking_payment_${String(index + 1).padStart(3, "0")}`,
            customerId: customer.id,
            type: CustomerAccountEntryType.PAYMENT,
            amount: paymentAmount,
            occurredAt: addMinutes(appointmentAt, 75),
            note: `${SEED_NOTE} Partial payment received`,
            createdByAdminId: admin.id,
            referenceType: "BOOKING",
            referenceId: booking.id
          }
        ]
      });
      customerBalances.set(customer.id, round2((customerBalances.get(customer.id) ?? 0) + chargeAmount - paymentAmount));
    }

    bookings.push({ id: booking.id, appointmentAt: booking.appointmentAt });
  }

  await seedWalkInIncome(admin.id, dayStarts, activeDayIndexes);
  await seedExpensesAndStock(admin.id, employees, suppliers, parts, bookings, dayStarts, activeDayIndexes, todayStart);

  const transactionCount = await prisma.transaction.count({ where: { id: { startsWith: `${SEED_PREFIX}_tx_` } } });
  const bookingCount = await prisma.booking.count({ where: { id: { startsWith: `${SEED_PREFIX}_booking_` } } });
  const customerCount = await prisma.user.count({ where: { phone: { in: SEEDED_CUSTOMER_PHONES } } });
  const totalIncome = await sumTransactions(TransactionType.INCOME);
  const totalExpenses = await sumTransactions(TransactionType.EXPENSE);

  console.log("========================================");
  console.log("Full test dataset seeded.");
  console.log("========================================");
  console.log(`total bookings     ${bookingCount}`);
  console.log(`total income       ${totalIncome.toFixed(2)} JOD`);
  console.log(`total expenses     ${totalExpenses.toFixed(2)} JOD`);
  console.log(`total customers    ${customerCount}`);
  console.log(`total transactions ${transactionCount}`);
  console.log("========================================");
  console.log("Booking mix: completed 40 | approved(confirm) 20 | pending 20 | no_show 20 | cancelled 20");
  console.log("Guaranteed alerts: low inventory and overdue customer debt.");
}

async function clearPreviousSeedData(adminId: string): Promise<void> {
  const seedExpenseIds = (
    await prisma.expense.findMany({
      where: { id: { startsWith: `${SEED_PREFIX}_expense_` } },
      select: { id: true }
    })
  ).map((item) => item.id);

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { id: { startsWith: `${SEED_PREFIX}_` } },
        { entityId: { startsWith: `${SEED_PREFIX}_` } },
        { actorId: adminId, entityId: { startsWith: `${SEED_PREFIX}_booking_` } }
      ]
    }
  });

  await prisma.transaction.deleteMany({
    where: {
      OR: [
        { id: { startsWith: `${SEED_PREFIX}_tx_` } },
        { bookingId: { startsWith: `${SEED_PREFIX}_booking_` } },
        seedExpenseIds.length ? { expenseId: { in: seedExpenseIds } } : undefined
      ].filter(Boolean) as Array<Record<string, unknown>>
    }
  });

  await prisma.stockMovement.deleteMany({ where: { id: { startsWith: `${SEED_PREFIX}_movement_` } } });
  await prisma.customerAccountEntry.deleteMany({ where: { id: { startsWith: `${SEED_PREFIX}_ledger_` } } });
  await prisma.expense.deleteMany({ where: { id: { startsWith: `${SEED_PREFIX}_expense_` } } });
  await prisma.salaryPayment.deleteMany({ where: { id: { startsWith: `${SEED_PREFIX}_salary_` } } });
  await prisma.attendanceEvent.deleteMany({ where: { id: { startsWith: `${SEED_PREFIX}_attendance_event_` } } });
  await prisma.attendanceDay.deleteMany({ where: { id: { startsWith: `${SEED_PREFIX}_attendance_day_` } } });
  await prisma.attendance.deleteMany({ where: { id: { startsWith: `${SEED_PREFIX}_attendance_` } } });
  await prisma.booking.deleteMany({ where: { id: { startsWith: `${SEED_PREFIX}_booking_` } } });
  await prisma.employeePermissionGrant.deleteMany({ where: { employeeId: { startsWith: `${SEED_PREFIX}_employee_` } } });
  await prisma.employee.deleteMany({ where: { id: { startsWith: `${SEED_PREFIX}_employee_` } } });
  await prisma.user.deleteMany({
    where: {
      OR: [
        { id: { startsWith: `${SEED_PREFIX}_customer_` } },
        { id: { startsWith: `${SEED_PREFIX}_employee_user_` } }
      ]
    }
  });
  await prisma.supplier.deleteMany({ where: { id: { startsWith: `${SEED_PREFIX}_supplier_` } } });
  await prisma.part.deleteMany({ where: { id: { startsWith: `${SEED_PREFIX}_part_` } } });
  await prisma.service.deleteMany({ where: { id: { startsWith: `${SEED_PREFIX}_service_` } } });
}

async function seedServices(): Promise<SeedService[]> {
  const result: SeedService[] = [];
  for (const service of SERVICE_CATALOG) {
    const descriptions = SERVICE_DESCRIPTIONS[service.code];
    const item = await prisma.service.create({
      data: {
        id: `${SEED_PREFIX}_service_${service.code}`,
        nameEn: service.nameEn,
        nameAr: service.nameAr,
        category: service.category,
        basePrice: service.basePrice,
        durationMinutes: service.durationMinutes,
        descriptionEn: descriptions?.descriptionEn ?? service.nameEn,
        descriptionAr: descriptions?.descriptionAr ?? service.nameAr,
        isActive: true
      }
    });

    result.push({
      id: item.id,
      code: service.code,
      nameEn: item.nameEn,
      nameAr: item.nameAr,
      category: item.category,
      basePrice: Number(item.basePrice ?? 0),
      durationMinutes: item.durationMinutes
    });
  }
  return result;
}

async function seedSuppliers(): Promise<SeedSupplier[]> {
  const result: SeedSupplier[] = [];
  for (const supplier of SUPPLIER_DATA) {
    const item = await prisma.supplier.create({
      data: {
        id: `${SEED_PREFIX}_supplier_${supplier.code}`,
        name: supplier.name,
        phone: supplier.phone,
        address: `${SEED_NOTE} ${supplier.address}`,
        email: `${supplier.code}@seed.local`
      }
    });
    result.push({ id: item.id, name: item.name });
  }
  return result;
}

async function seedEmployees(adminId: string): Promise<SeedEmployee[]> {
  const passwordHash = await bcrypt.hash("Employee123!", 10);
  const result: SeedEmployee[] = [];

  for (const employee of EMPLOYEE_DATA) {
    const userId = `${SEED_PREFIX}_employee_user_${employee.code}`;
    const employeeId = `${SEED_PREFIX}_employee_${employee.code}`;

    const user = await prisma.user.upsert({
      where: { phone: employee.phone },
      update: {
        passwordHash,
        fullName: employee.fullName,
        role: Role.EMPLOYEE,
        status: UserStatus.ACTIVE,
        isActive: true
      },
      create: {
        id: userId,
        phone: employee.phone,
        passwordHash,
        fullName: employee.fullName,
        role: Role.EMPLOYEE,
        status: UserStatus.ACTIVE,
        isActive: true,
        createdAt: addDays(new Date(), -120)
      }
    });

    const employeeRecord = await prisma.employee.upsert({
      where: { userId: user.id },
      update: {
        createdByAdminId: adminId,
        nationalIdHash: sha256(`${SEED_PREFIX}_${employee.code}_nid`),
        nationalIdEncrypted: `enc:${employee.code}:nid`,
        birthDateEncrypted: `enc:${employee.code}:1992-01-01`,
        jobTitleEncrypted: `enc:${employee.jobTitle}`,
        defaultSalaryEncrypted: `enc:${employee.monthlyBase}`,
        workScheduleEncrypted: "enc:Sun-Thu 09:00-18:00",
        roleProfile:
          employee.jobTitle.includes("Advisor")
            ? EmployeeRoleProfile.RECEPTION
            : employee.jobTitle.includes("Parts")
              ? EmployeeRoleProfile.MANAGER
              : EmployeeRoleProfile.TECHNICIAN,
        employmentType: EmploymentType.FULL_TIME,
        employmentStatus: EmploymentStatus.ACTIVE,
        department: employee.department,
        jobTitle: employee.jobTitle,
        monthlyBase: employee.monthlyBase,
        startDate: addDays(new Date(), -240),
        hiredAt: addDays(new Date(), -240),
        isActive: true
      },
      create: {
        id: employeeId,
        userId: user.id,
        createdByAdminId: adminId,
        nationalIdHash: sha256(`${SEED_PREFIX}_${employee.code}_nid`),
        nationalIdEncrypted: `enc:${employee.code}:nid`,
        birthDateEncrypted: `enc:${employee.code}:1992-01-01`,
        jobTitleEncrypted: `enc:${employee.jobTitle}`,
        defaultSalaryEncrypted: `enc:${employee.monthlyBase}`,
        workScheduleEncrypted: "enc:Sun-Thu 09:00-18:00",
        roleProfile:
          employee.jobTitle.includes("Advisor")
            ? EmployeeRoleProfile.RECEPTION
            : employee.jobTitle.includes("Parts")
              ? EmployeeRoleProfile.MANAGER
              : EmployeeRoleProfile.TECHNICIAN,
        employmentType: EmploymentType.FULL_TIME,
        employmentStatus: EmploymentStatus.ACTIVE,
        department: employee.department,
        jobTitle: employee.jobTitle,
        monthlyBase: employee.monthlyBase,
        startDate: addDays(new Date(), -240),
        hiredAt: addDays(new Date(), -240),
        isActive: true
      }
    });

    await prisma.employeePermissionGrant.deleteMany({ where: { employeeId: employeeRecord.id } });
    await prisma.employeePermissionGrant.createMany({
      data: employee.permissions.map((permission) => ({
        id: `${SEED_PREFIX}_permission_${employee.code}_${permission.toLowerCase()}`,
        employeeId: employeeRecord.id,
        permission
      }))
    });

    result.push({
      id: employeeRecord.id,
      userId: user.id,
      fullName: employee.fullName,
      monthlyBase: employee.monthlyBase
    });
  }

  return result;
}

async function seedAttendance(adminId: string, employees: SeedEmployee[], dayStarts: Date[]): Promise<void> {
  let attendanceIndex = 1;
  let eventIndex = 1;
  const recentDays = dayStarts.slice(-45);

  for (let employeePosition = 0; employeePosition < employees.length; employeePosition += 1) {
    const employee = employees[employeePosition];
    for (let dayOffset = 0; dayOffset < recentDays.length; dayOffset += 1) {
      const dayStart = recentDays[dayOffset];
      if (dayStart.getUTCDay() === 5) continue;
      if ((employeePosition + dayOffset) % 9 === 0) continue;

      const checkInAt = addMinutes(addHours(dayStart, 8), 45 + ((employeePosition + dayOffset) % 25));
      const checkOutAt = addHours(checkInAt, 8 + ((employeePosition + dayOffset) % 2));
      const dayKey = formatDate(checkInAt);

      await prisma.attendance.create({
        data: {
          id: `${SEED_PREFIX}_attendance_${String(attendanceIndex).padStart(4, "0")}`,
          employeeId: employee.id,
          checkInAt,
          checkOutAt,
          qrPayload: `${SEED_PREFIX}:${employee.id}:${dayKey}`,
          note: `${SEED_NOTE} Shift recorded`
        }
      });

      await prisma.attendanceDay.create({
        data: {
          id: `${SEED_PREFIX}_attendance_day_${String(attendanceIndex).padStart(4, "0")}`,
          employeeId: employee.id,
          dayKey,
          checkInAt,
          checkOutAt,
          workedMinutes: Math.max(Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60000), 0),
          status: "CLOSED"
        }
      });

      await prisma.attendanceEvent.createMany({
        data: [
          {
            id: `${SEED_PREFIX}_attendance_event_${String(eventIndex).padStart(4, "0")}`,
            employeeId: employee.id,
            type: "CHECK_IN",
            occurredAt: checkInAt,
            dayKey,
            status: "ACCEPTED",
            userAgent: "seed-script"
          },
          {
            id: `${SEED_PREFIX}_attendance_event_${String(eventIndex + 1).padStart(4, "0")}`,
            employeeId: employee.id,
            type: "CHECK_OUT",
            occurredAt: checkOutAt,
            dayKey,
            status: "ACCEPTED",
            userAgent: "seed-script"
          }
        ]
      });

      attendanceIndex += 1;
      eventIndex += 2;
    }
  }

  await prisma.auditLog.create({
    data: {
      id: `${SEED_PREFIX}_attendance_audit_bootstrap`,
      action: "ATTENDANCE_SEED_CREATED",
      entity: "Attendance",
      entityId: `${SEED_PREFIX}_attendance_batch`,
      actorId: adminId,
      payload: { employees: employees.length, days: recentDays.length }
    }
  });
}

async function seedSalaryPayments(adminId: string, employees: SeedEmployee[], todayStart: Date): Promise<void> {
  let salaryIndex = 1;
  for (let monthOffset = 0; monthOffset < 3; monthOffset += 1) {
    const baseDate = new Date(Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth() - monthOffset, 1, 10, 0, 0));
    const paidAt = addDays(baseDate, 2);

    for (const employee of employees) {
      const item = await prisma.salaryPayment.create({
        data: {
          id: `${SEED_PREFIX}_salary_${String(salaryIndex).padStart(3, "0")}`,
          employeeId: employee.id,
          amount: employee.monthlyBase,
          remainingBalance: 0,
          periodMonth: baseDate.getUTCMonth() + 1,
          periodYear: baseDate.getUTCFullYear(),
          status: SalaryPaymentStatus.PAID,
          paidAt,
          note: `${SEED_NOTE} Monthly payroll`,
          recordedById: adminId
        }
      });

      await prisma.auditLog.create({
        data: {
          id: `${SEED_PREFIX}_salary_audit_${String(salaryIndex).padStart(3, "0")}`,
          action: "SALARY_PAYMENT_CREATED",
          entity: "SalaryPayment",
          entityId: item.id,
          actorId: adminId,
          payload: { employeeId: employee.id, amount: employee.monthlyBase }
        }
      });

      salaryIndex += 1;
    }
  }
}

async function seedCustomers(adminId: string, dayStarts: Date[]): Promise<SeedUser[]> {
  const passwordHash = await bcrypt.hash("Customer123!", 10);
  const result: SeedUser[] = [];

  for (let index = 0; index < TOTAL_CUSTOMERS; index += 1) {
    const [firstName, lastName] = CUSTOMER_PROFILES[index];
    const [carCompany, carModel, carYear] = CAR_PROFILES[index % CAR_PROFILES.length];
    const joinDate = addDays(dayStarts[0], (index * 3) % 70);

    const item = await prisma.user.upsert({
      where: { phone: seedCustomerPhone(index) },
      update: {
        passwordHash,
        role: Role.CUSTOMER,
        status: UserStatus.ACTIVE,
        isActive: true,
        fullName: `${firstName} ${lastName}`,
        carCompany,
        carModel,
        carYear,
        governorate: "Amman",
        city: "Amman",
        location: "Amman",
        licensePlate: `${randomInt(10, 99)}-${randomInt(10000, 99999)}`,
        preferredContact: index % 4 === 0 ? "WHATSAPP" : "PHONE"
      },
      create: {
        id: `${SEED_PREFIX}_customer_${String(index + 1).padStart(2, "0")}`,
        phone: seedCustomerPhone(index),
        passwordHash,
        role: Role.CUSTOMER,
        status: UserStatus.ACTIVE,
        isActive: true,
        fullName: `${firstName} ${lastName}`,
        carCompany,
        carModel,
        carYear,
        governorate: "Amman",
        city: "Amman",
        location: "Amman",
        licensePlate: `${randomInt(10, 99)}-${randomInt(10000, 99999)}`,
        preferredContact: index % 4 === 0 ? "WHATSAPP" : "PHONE",
        createdAt: joinDate
      }
    });

    await prisma.auditLog.create({
      data: {
        id: `${SEED_PREFIX}_customer_audit_${String(index + 1).padStart(2, "0")}`,
        action: "CUSTOMER_SEED_CREATED",
        entity: "User",
        entityId: item.id,
        actorId: adminId
      }
    });

    result.push({ id: item.id, fullName: item.fullName, phone: item.phone });
  }

  return result;
}

async function seedCustomerLedger(adminId: string, customers: SeedUser[], dayStarts: Date[]): Promise<Map<string, number>> {
  const balances = new Map<string, number>();
  let ledgerIndex = 1;

  for (let index = 0; index < customers.length; index += 1) {
    const customer = customers[index];
    const profileType = index < 6 ? "overdue_high" : index < 12 ? "active_debt" : index < 20 ? "settled" : "mixed";

    if (profileType === "overdue_high") {
      await createLedgerEntry(customer.id, adminId, ledgerIndex++, CustomerAccountEntryType.CHARGE, 220 + index * 18, addHours(dayStarts[6 + index], 10), "Battery and labor charge");
      await createLedgerEntry(customer.id, adminId, ledgerIndex++, CustomerAccountEntryType.CHARGE, 70 + index * 6, addHours(dayStarts[18 + index], 12), "Follow-up parts charge");
      await createLedgerEntry(customer.id, adminId, ledgerIndex++, CustomerAccountEntryType.ADJUSTMENT, 15, addHours(dayStarts[24 + index], 11), "Delayed payment fee");
      balances.set(customer.id, 305 + index * 24);
      continue;
    }

    if (profileType === "active_debt") {
      const chargeAmount = 160 + index * 10;
      const paymentAmount = 105 + index * 3;
      await createLedgerEntry(customer.id, adminId, ledgerIndex++, CustomerAccountEntryType.CHARGE, chargeAmount, addHours(dayStarts[30 + index], 9), "Open workshop invoice");
      await createLedgerEntry(customer.id, adminId, ledgerIndex++, CustomerAccountEntryType.PAYMENT, paymentAmount, addHours(dayStarts[42 + index], 14), "Installment payment");
      balances.set(customer.id, chargeAmount - paymentAmount);
      continue;
    }

    if (profileType === "settled") {
      const amount = 110 + index * 4;
      await createLedgerEntry(customer.id, adminId, ledgerIndex++, CustomerAccountEntryType.CHARGE, amount, addHours(dayStarts[16 + index], 10), "Service charge");
      await createLedgerEntry(customer.id, adminId, ledgerIndex++, CustomerAccountEntryType.PAYMENT, amount, addHours(dayStarts[17 + index], 16), "Paid in full");
      await createLedgerEntry(customer.id, adminId, ledgerIndex++, CustomerAccountEntryType.ADJUSTMENT, -5, addHours(dayStarts[40 + index], 13), "Loyalty goodwill adjustment");
      balances.set(customer.id, -5);
      continue;
    }

    const chargeAmount = 90 + index * 5;
    const firstPayment = 40 + index * 2;
    const secondPayment = index % 2 === 0 ? 25 : 0;
    await createLedgerEntry(customer.id, adminId, ledgerIndex++, CustomerAccountEntryType.CHARGE, chargeAmount, addHours(dayStarts[20 + index], 11), "Service balance");
    await createLedgerEntry(customer.id, adminId, ledgerIndex++, CustomerAccountEntryType.PAYMENT, firstPayment, addHours(dayStarts[Math.min(dayStarts.length - 1, 35 + index)], 15), "Counter payment");
    if (secondPayment > 0) {
      await createLedgerEntry(customer.id, adminId, ledgerIndex++, CustomerAccountEntryType.PAYMENT, secondPayment, addHours(dayStarts[Math.min(dayStarts.length - 1, 55 + index)], 13), "Transfer payment");
    }
    balances.set(customer.id, chargeAmount - firstPayment - secondPayment);
  }

  return balances;
}

async function createLedgerEntry(
  customerId: string,
  adminId: string,
  index: number,
  type: CustomerAccountEntryType,
  amount: number,
  occurredAt: Date,
  note: string
): Promise<void> {
  await prisma.customerAccountEntry.create({
    data: {
      id: `${SEED_PREFIX}_ledger_${String(index).padStart(4, "0")}`,
      customerId,
      type,
      amount,
      occurredAt,
      note: `${SEED_NOTE} ${note}`,
      createdByAdminId: adminId,
      referenceType: "LEDGER_SEED",
      referenceId: `${SEED_PREFIX}_ledger_ref_${index}`
    }
  });
}

async function seedParts(): Promise<SeedPart[]> {
  const result: SeedPart[] = [];
  for (const part of PART_DATA) {
    const item = await prisma.part.create({
      data: {
        id: `${SEED_PREFIX}_part_${part.code}`,
        name: part.name,
        sku: `${SEED_PREFIX.toUpperCase()}-${part.code.toUpperCase()}`,
        vehicleModel: part.vehicleModel,
        vehicleType: part.vehicleType,
        category: part.category,
        unit: part.unit,
        costPrice: part.costPrice,
        sellPrice: part.sellPrice,
        stockQty: part.finalQty,
        lowStockThreshold: part.threshold,
        isActive: true
      }
    });

    result.push({
      id: item.id,
      code: part.code,
      name: item.name,
      costPrice: Number(item.costPrice ?? 0),
      sellPrice: Number(item.sellPrice ?? 0),
      lowStockThreshold: item.lowStockThreshold,
      stockQty: item.stockQty
    });
  }
  return result;
}

async function seedWalkInIncome(adminId: string, dayStarts: Date[], activeDayIndexes: number[]): Promise<void> {
  for (let index = 0; index < 26; index += 1) {
    const dayIndex = activeDayIndexes[(index * 7) % activeDayIndexes.length];
    const occurredAt = addHours(dayStarts[dayIndex], 10 + (index % 7));
    const amount = round2(randomBetween(18, 140) + (index % 5) * 6);
    await prisma.transaction.create({
      data: {
        id: `${SEED_PREFIX}_tx_walkin_${String(index + 1).padStart(3, "0")}`,
        type: TransactionType.INCOME,
        incomeSource: IncomeSource.WALK_IN,
        itemName: pickFrom(WALK_IN_ITEMS),
        unitPrice: amount,
        quantity: 1,
        amount,
        costTotal: 0,
        profitAmount: amount,
        note: `${SEED_NOTE} Walk-in counter sale`,
        description: "Walk-in income",
        referenceType: "WALK_IN",
        referenceId: `${SEED_PREFIX}_walkin_${index + 1}`,
        occurredAt,
        recordedAt: occurredAt,
        createdById: adminId
      }
    });
  }
}

async function seedExpensesAndStock(
  adminId: string,
  employees: SeedEmployee[],
  suppliers: SeedSupplier[],
  parts: SeedPart[],
  bookings: Array<{ id: string; appointmentAt: Date }>,
  dayStarts: Date[],
  activeDayIndexes: number[],
  todayStart: Date
): Promise<void> {
  const salaryDates = [
    new Date(Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth(), 2, 9, 0, 0)),
    new Date(Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth() - 1, 2, 9, 0, 0)),
    new Date(Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth() - 2, 2, 9, 0, 0))
  ];

  let expenseSequence = 1;

  for (const date of salaryDates) {
    for (const employee of employees) {
      const amount = employee.monthlyBase;
      const expense = await prisma.expense.create({
        data: {
          id: `${SEED_PREFIX}_expense_salary_${String(expenseSequence).padStart(3, "0")}`,
          amount,
          note: `${SEED_NOTE} Salary payout for ${employee.fullName}`,
          expenseCategory: ExpenseCategory.SALARY,
          expenseDate: date,
          createdById: adminId
        }
      });

      await prisma.transaction.create({
        data: {
          id: `${SEED_PREFIX}_tx_expense_salary_${String(expenseSequence).padStart(3, "0")}`,
          type: TransactionType.EXPENSE,
          expenseCategory: ExpenseCategory.SALARY,
          itemName: `Salary - ${employee.fullName}`,
          unitPrice: amount,
          quantity: 1,
          amount,
          costTotal: amount,
          profitAmount: -amount,
          note: `${SEED_NOTE} Salary payment`,
          description: `Salary payment for ${employee.fullName}`,
          expenseId: expense.id,
          referenceType: "SALARY_PAYMENT",
          referenceId: employee.id,
          occurredAt: date,
          recordedAt: date,
          createdById: adminId
        }
      });

      expenseSequence += 1;
    }
  }

  for (let index = 0; index < 14; index += 1) {
    const supplier = suppliers[index % suppliers.length];
    const part = parts[index % parts.length];
    const dayIndex = activeDayIndexes[(index * 5 + 3) % activeDayIndexes.length];
    const occurredAt = addHours(dayStarts[dayIndex], 8 + (index % 4));
    const quantity = 4 + (index % 6);
    const amount = round2(quantity * part.costPrice * (1.05 + (index % 3) * 0.04));

    const expense = await prisma.expense.create({
      data: {
        id: `${SEED_PREFIX}_expense_supplier_${String(expenseSequence).padStart(3, "0")}`,
        amount,
        note: `${SEED_NOTE} Supplier restock - ${part.name}`,
        supplierId: supplier.id,
        expenseCategory: ExpenseCategory.SUPPLIER,
        expenseDate: occurredAt,
        createdById: adminId
      }
    });

    await prisma.transaction.create({
      data: {
        id: `${SEED_PREFIX}_tx_expense_supplier_${String(expenseSequence).padStart(3, "0")}`,
        type: TransactionType.EXPENSE,
        expenseCategory: ExpenseCategory.SUPPLIER,
        itemName: `${supplier.name} - ${part.name}`,
        unitPrice: amount,
        quantity: 1,
        amount,
        costTotal: amount,
        profitAmount: -amount,
        note: `${SEED_NOTE} Supplier purchase`,
        description: `Supplier restock for ${part.name}`,
        expenseId: expense.id,
        referenceType: "SUPPLIER_PURCHASE",
        referenceId: supplier.id,
        occurredAt,
        recordedAt: occurredAt,
        createdById: adminId
      }
    });

    await prisma.stockMovement.create({
      data: {
        id: `${SEED_PREFIX}_movement_restock_${String(index + 1).padStart(3, "0")}`,
        partId: part.id,
        type: StockMovementType.IN,
        quantity,
        occurredAt,
        note: `${SEED_NOTE} Restocked from ${supplier.name}`,
        createdById: adminId,
        supplierId: supplier.id
      }
    });

    expenseSequence += 1;
  }

  for (let index = 0; index < 55; index += 1) {
    const dayIndex = activeDayIndexes[(index * 3 + 1) % activeDayIndexes.length];
    const occurredAt = addHours(dayStarts[dayIndex], 17 - (index % 5));
    const amount = round2(randomBetween(12, 48) + (index % 4) * 3.5);
    const itemName = pickFrom(GENERAL_EXPENSE_ITEMS);
    const expense = await prisma.expense.create({
      data: {
        id: `${SEED_PREFIX}_expense_general_${String(expenseSequence).padStart(3, "0")}`,
        amount,
        note: `${SEED_NOTE} ${itemName}`,
        expenseCategory: ExpenseCategory.GENERAL,
        expenseDate: occurredAt,
        createdById: adminId
      }
    });

    await prisma.transaction.create({
      data: {
        id: `${SEED_PREFIX}_tx_expense_general_${String(expenseSequence).padStart(3, "0")}`,
        type: TransactionType.EXPENSE,
        expenseCategory: ExpenseCategory.GENERAL,
        itemName,
        unitPrice: amount,
        quantity: 1,
        amount,
        costTotal: amount,
        profitAmount: -amount,
        note: `${SEED_NOTE} General expense`,
        description: "Operational expense",
        expenseId: expense.id,
        referenceType: "GENERAL_EXPENSE",
        referenceId: `${SEED_PREFIX}_general_${expenseSequence}`,
        occurredAt,
        recordedAt: occurredAt,
        createdById: adminId
      }
    });

    expenseSequence += 1;
  }

  for (let index = 0; index < 16; index += 1) {
    const part = parts[(index * 2) % parts.length];
    const booking = bookings[index * 2];
    const movementType =
      index % 5 === 0 ? StockMovementType.ADJUST : index % 2 === 0 ? StockMovementType.SALE : StockMovementType.OUT;

    await prisma.stockMovement.create({
      data: {
        id: `${SEED_PREFIX}_movement_usage_${String(index + 1).padStart(3, "0")}`,
        partId: part.id,
        type: movementType,
        quantity: 1 + (index % 3),
        occurredAt: addMinutes(booking.appointmentAt, 20),
        note:
          movementType === StockMovementType.ADJUST
            ? `${SEED_NOTE} Stock count correction`
            : movementType === StockMovementType.SALE
              ? `${SEED_NOTE} Part sold with service`
              : `${SEED_NOTE} Part used during service`,
        createdById: adminId,
        bookingId: booking.id
      }
    });
  }
}

async function createBookingAuditTrail(input: {
  adminId: string;
  bookingId: string;
  appointmentAt: Date;
  createdAt: Date;
  finalStatus: BookingStatus;
  finalPrice: number | null;
  employeeId: string | null;
  index: number;
}): Promise<void> {
  const { adminId, bookingId, appointmentAt, createdAt, finalStatus, finalPrice, employeeId, index } = input;

  const logs: Array<{
    id: string;
    action: string;
    createdAt: Date;
    payload?: Prisma.InputJsonValue;
  }> = [
    {
      id: `${SEED_PREFIX}_audit_booking_create_${String(index + 1).padStart(3, "0")}`,
      action: "BOOKING_CREATED",
      createdAt,
      payload: { status: BookingStatus.PENDING, source: SEED_NOTE }
    }
  ];

  if (finalStatus === BookingStatus.PENDING) {
    if (index % 5 === 0) {
      logs.push(
        {
          id: `${SEED_PREFIX}_audit_booking_reopen_a_${String(index + 1).padStart(3, "0")}`,
          action: "BOOKING_STATUS_CHANGE",
          createdAt: addHours(createdAt, 3),
          payload: { from: BookingStatus.PENDING, to: BookingStatus.CANCELLED, note: "Customer delayed confirmation" }
        },
        {
          id: `${SEED_PREFIX}_audit_booking_reopen_b_${String(index + 1).padStart(3, "0")}`,
          action: "BOOKING_STATUS_CHANGE",
          createdAt: addHours(createdAt, 18),
          payload: { from: BookingStatus.CANCELLED, to: BookingStatus.PENDING, note: "Booking reopened by advisor" }
        }
      );
    }
  } else if (finalStatus === BookingStatus.APPROVED) {
    logs.push({
      id: `${SEED_PREFIX}_audit_booking_approved_${String(index + 1).padStart(3, "0")}`,
      action: "BOOKING_STATUS_CHANGE",
      createdAt: addHours(createdAt, 6),
      payload: { from: BookingStatus.PENDING, to: BookingStatus.APPROVED }
    });
    if (index % 4 === 0) {
      logs.push(
        {
          id: `${SEED_PREFIX}_audit_booking_approved_cancel_${String(index + 1).padStart(3, "0")}`,
          action: "BOOKING_STATUS_CHANGE",
          createdAt: addHours(createdAt, 20),
          payload: { from: BookingStatus.APPROVED, to: BookingStatus.CANCELLED, note: "Temporary cancellation" }
        },
        {
          id: `${SEED_PREFIX}_audit_booking_approved_reopen_${String(index + 1).padStart(3, "0")}`,
          action: "BOOKING_STATUS_CHANGE",
          createdAt: addHours(createdAt, 26),
          payload: { from: BookingStatus.CANCELLED, to: BookingStatus.APPROVED, note: "Customer confirmed return" }
        }
      );
    }
  } else if (finalStatus === BookingStatus.CANCELLED) {
    logs.push(
      {
        id: `${SEED_PREFIX}_audit_booking_cancel_approved_${String(index + 1).padStart(3, "0")}`,
        action: "BOOKING_STATUS_CHANGE",
        createdAt: addHours(createdAt, 5),
        payload: { from: BookingStatus.PENDING, to: BookingStatus.APPROVED }
      },
      {
        id: `${SEED_PREFIX}_audit_booking_cancel_final_${String(index + 1).padStart(3, "0")}`,
        action: "BOOKING_STATUS_CHANGE",
        createdAt: addHours(createdAt, 27),
        payload: { from: BookingStatus.APPROVED, to: BookingStatus.CANCELLED, note: "Customer cancelled before arrival" }
      }
    );
  } else if (finalStatus === BookingStatus.NO_SHOW) {
    logs.push(
      {
        id: `${SEED_PREFIX}_audit_booking_noshow_approved_${String(index + 1).padStart(3, "0")}`,
        action: "BOOKING_STATUS_CHANGE",
        createdAt: addHours(createdAt, 4),
        payload: { from: BookingStatus.PENDING, to: BookingStatus.APPROVED }
      },
      {
        id: `${SEED_PREFIX}_audit_booking_noshow_final_${String(index + 1).padStart(3, "0")}`,
        action: "BOOKING_STATUS_CHANGE",
        createdAt: addMinutes(appointmentAt, 25),
        payload: { from: BookingStatus.APPROVED, to: BookingStatus.NO_SHOW }
      }
    );
  } else if (finalStatus === BookingStatus.COMPLETED) {
    logs.push(
      {
        id: `${SEED_PREFIX}_audit_booking_complete_quote_${String(index + 1).padStart(3, "0")}`,
        action: "BOOKING_STATUS_CHANGE",
        createdAt: addHours(createdAt, 3),
        payload: { from: BookingStatus.PENDING, to: BookingStatus.PRICE_SET }
      },
      {
        id: `${SEED_PREFIX}_audit_booking_complete_approved_${String(index + 1).padStart(3, "0")}`,
        action: "BOOKING_STATUS_CHANGE",
        createdAt: addHours(createdAt, 8),
        payload: { from: BookingStatus.PRICE_SET, to: BookingStatus.APPROVED }
      }
    );

    if (index % 7 === 0) {
      logs.push(
        {
          id: `${SEED_PREFIX}_audit_booking_complete_reopen_a_${String(index + 1).padStart(3, "0")}`,
          action: "BOOKING_STATUS_CHANGE",
          createdAt: addMinutes(appointmentAt, 15),
          payload: { from: BookingStatus.APPROVED, to: BookingStatus.COMPLETED, finalPrice, performedByEmployeeId: employeeId }
        },
        {
          id: `${SEED_PREFIX}_audit_booking_complete_reopen_b_${String(index + 1).padStart(3, "0")}`,
          action: "BOOKING_STATUS_CHANGE",
          createdAt: addMinutes(appointmentAt, 45),
          payload: { from: BookingStatus.COMPLETED, to: BookingStatus.APPROVED, note: "Reopened to correct final quote" }
        }
      );
    }

    logs.push({
      id: `${SEED_PREFIX}_audit_booking_complete_final_${String(index + 1).padStart(3, "0")}`,
      action: "BOOKING_STATUS_CHANGE",
      createdAt: addMinutes(appointmentAt, 95),
      payload: { from: BookingStatus.APPROVED, to: BookingStatus.COMPLETED, finalPrice, performedByEmployeeId: employeeId }
    });
  }

  await prisma.auditLog.createMany({
    data: logs.map((log) => ({
      id: log.id,
      action: log.action,
      entity: "Booking",
      entityId: bookingId,
      actorId: adminId,
      payload: log.payload,
      createdAt: log.createdAt
    }))
  });
}

async function sumTransactions(type: TransactionType): Promise<number> {
  const row = await prisma.transaction.aggregate({
    where: { id: { startsWith: `${SEED_PREFIX}_tx_` }, type },
    _sum: { amount: true }
  });
  return Number(row._sum.amount ?? 0);
}

function buildBookingStatusPool(): BookingStatus[] {
  return [
    ...Array.from({ length: 40 }, () => BookingStatus.COMPLETED),
    ...Array.from({ length: 20 }, () => BookingStatus.APPROVED),
    ...Array.from({ length: 20 }, () => BookingStatus.PENDING),
    ...Array.from({ length: 20 }, () => BookingStatus.NO_SHOW),
    ...Array.from({ length: 20 }, () => BookingStatus.CANCELLED)
  ];
}

function allocateBookingsAcrossDays(total: number, activeDayIndexes: number[]): number[] {
  const result: number[] = [];
  const baseDayIndexes = [...activeDayIndexes];
  shuffleInPlace(baseDayIndexes);

  for (let index = 0; index < total; index += 1) {
    result.push(baseDayIndexes[index % baseDayIndexes.length]);
  }

  result.sort((a, b) => a - b || randomInt(-1, 1));
  return result;
}

function pickCustomer(customers: SeedUser[], bookingIndex: number): SeedUser {
  const weightedIndexes = [
    0, 1, 2, 3, 4, 5,
    0, 1, 2, 6, 7, 8,
    9, 10, 11, 12, 13, 14,
    15, 16, 17, 18, 19, 20,
    21, 22, 23, 24, 25, 26,
    27, 28, 29
  ];
  return customers[weightedIndexes[bookingIndex % weightedIndexes.length]];
}

function appointmentForDay(dayStart: Date, durationMinutes: number, bookingIndex: number): Date {
  const slotHours = [9, 10, 11, 12, 13, 14, 15, 16];
  const hour = slotHours[(bookingIndex + Math.floor(durationMinutes / 30)) % slotHours.length];
  const minute = bookingIndex % 2 === 0 ? 0 : 30;
  return new Date(Date.UTC(dayStart.getUTCFullYear(), dayStart.getUTCMonth(), dayStart.getUTCDate(), hour, minute, 0));
}

function variedPrice(basePrice: number, maxVariance: number): number {
  const variance = 1 + randomBetween(-maxVariance, maxVariance);
  return round2(Math.min(300, Math.max(15, basePrice * variance)));
}

function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((sum, value) => sum + value, 0);
  let target = randomBetween(0, total);
  for (let index = 0; index < items.length; index += 1) {
    target -= weights[index] ?? 1;
    if (target <= 0) return items[index];
  }
  return items[items.length - 1];
}

function pickFrom<T>(items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function shuffleInPlace<T>(items: T[]): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

function randomBetween(min: number, max: number): number {
  return min + (max - min) * rng();
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function atUtcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
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
