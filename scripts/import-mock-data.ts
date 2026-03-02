import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import {
  BookingStatus,
  ExpenseCategory,
  IncomeSource,
  InvoiceLineType,
  InvoiceStatus,
  InvoiceType,
  PrismaClient,
  Role,
  StockMovementType,
  TransactionType
} from "@prisma/client";

type MockCustomer = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  city: string;
  createdAt: string;
};

type MockVehicle = {
  id: string;
  customerId: string;
  carType: "EV" | "HYBRID" | "REGULAR";
  brand: string;
  model: string;
  year: number;
  plateNumber: string;
};

type MockService = {
  id: string;
  name: string;
  category: "EV" | "HYBRID" | "GENERAL";
  basePrice: number;
  durationMin: number;
};

type MockInventoryItem = {
  id: string;
  itemName: string;
  carType: "EV" | "HYBRID" | "REGULAR";
  cost: number;
  defaultSellingPrice: number;
  minimumQuantity: number;
  currentQuantity: number;
  supplierName: string;
};

type MockBooking = {
  bookingId: string;
  customerId: string;
  vehicleId: string;
  serviceId: string;
  bookingDate: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  finalPrice: number;
};

type MockInvoiceLine = {
  itemId: string;
  itemName: string;
  quantity: number;
  sellingPrice: number;
  lineTotal: number;
};

type MockSaleInvoice = {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  invoiceDate: string;
  items: MockInvoiceLine[];
  totalAmount: number;
};

type MockTransaction = {
  transactionId: string;
  type: "INCOME" | "EXPENSE";
  source: string;
  referenceId: string;
  description: string;
  amount: number;
  occurredAt: string;
};

type MockEmployee = {
  id: string;
  fullName: string;
  role: "ADMIN" | "MANAGER" | "RECEPTION" | "TECHNICIAN" | "ACCOUNTANT";
  salary: number;
  hireDate: string;
};

type MockData = {
  customers: MockCustomer[];
  vehicles: MockVehicle[];
  services: MockService[];
  inventoryItems: MockInventoryItem[];
  bookings: MockBooking[];
  saleInvoices: MockSaleInvoice[];
  transactions: MockTransaction[];
  employees: MockEmployee[];
};

const prisma = new PrismaClient();

function readMockData(): MockData {
  const filePath = path.resolve(process.cwd(), "mock-data.hybrid-ev-service-center.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as MockData;
}

function toDate(value: string): Date {
  return new Date(value);
}

function toBookingStatus(value: MockBooking["status"]): BookingStatus {
  switch (value) {
    case "CONFIRMED":
      return BookingStatus.APPROVED;
    case "COMPLETED":
      return BookingStatus.COMPLETED;
    case "CANCELLED":
      return BookingStatus.CANCELLED;
    default:
      return BookingStatus.PENDING;
  }
}

function mapIncomeSource(value: string): IncomeSource {
  if (value === "BOOKING") return IncomeSource.BOOKING;
  if (value === "WALK_IN") return IncomeSource.WALK_IN;
  return IncomeSource.INVOICE;
}

function mapExpenseCategory(value: string): ExpenseCategory {
  if (value === "INVENTORY_PURCHASE") return ExpenseCategory.SUPPLIER;
  if (value === "SALARY") return ExpenseCategory.SALARY;
  return ExpenseCategory.GENERAL;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main(): Promise<void> {
  const mock = readMockData();
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);

  const admin =
    (await prisma.user.findUnique({
      where: { phone: process.env.DEFAULT_ADMIN_PHONE ?? "0780000000" }
    })) ??
    (await prisma.user.create({
      data: {
        phone: process.env.DEFAULT_ADMIN_PHONE ?? "0780000000",
        passwordHash,
        fullName: process.env.DEFAULT_ADMIN_NAME ?? "System Admin",
        role: Role.ADMIN
      }
    }));

  const vehicleByCustomer = new Map<string, MockVehicle[]>();
  for (const vehicle of mock.vehicles) {
    const items = vehicleByCustomer.get(vehicle.customerId) ?? [];
    items.push(vehicle);
    vehicleByCustomer.set(vehicle.customerId, items);
  }

  const supplierIdByName = new Map<string, string>();

  for (const [index, supplierName] of [...new Set(mock.inventoryItems.map((item) => item.supplierName))].entries()) {
    const supplierId = `SUP${String(index + 1).padStart(3, "0")}`;
    supplierIdByName.set(supplierName, supplierId);
    await prisma.supplier.upsert({
      where: { id: supplierId },
      update: {
        name: supplierName,
        phone: `06${String(1000000 + index * 731).slice(0, 7)}`,
        email: `${slugify(supplierName)}@example.com`,
        address: "Amman, Jordan"
      },
      create: {
        id: supplierId,
        name: supplierName,
        phone: `06${String(1000000 + index * 731).slice(0, 7)}`,
        email: `${slugify(supplierName)}@example.com`,
        address: "Amman, Jordan"
      }
    });
  }

  for (const customer of mock.customers) {
    const primaryVehicle = vehicleByCustomer.get(customer.id)?.[0];
    await prisma.user.upsert({
      where: { id: customer.id },
      update: {
        fullName: customer.fullName,
        phone: customer.phone,
        passwordHash,
        role: Role.CUSTOMER,
        city: customer.city,
        governorate: customer.city,
        location: customer.city,
        carCompany: primaryVehicle?.brand,
        carType: primaryVehicle?.carType,
        carModel: primaryVehicle ? `${primaryVehicle.brand} ${primaryVehicle.model}` : null,
        carYear: primaryVehicle ? String(primaryVehicle.year) : null,
        licensePlate: primaryVehicle?.plateNumber,
        createdAt: toDate(customer.createdAt)
      },
      create: {
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.phone,
        passwordHash,
        role: Role.CUSTOMER,
        city: customer.city,
        governorate: customer.city,
        location: customer.city,
        carCompany: primaryVehicle?.brand,
        carType: primaryVehicle?.carType,
        carModel: primaryVehicle ? `${primaryVehicle.brand} ${primaryVehicle.model}` : null,
        carYear: primaryVehicle ? String(primaryVehicle.year) : null,
        licensePlate: primaryVehicle?.plateNumber,
        createdAt: toDate(customer.createdAt)
      }
    });
  }

  for (const employee of mock.employees) {
    const userId = `USR_${employee.id}`;
    await prisma.user.upsert({
      where: { id: userId },
      update: {
        fullName: employee.fullName,
        phone: `07${employee.id.slice(1).padStart(8, "0")}`,
        passwordHash,
        role: employee.role === "ADMIN" || employee.role === "MANAGER" ? Role.ADMIN : Role.EMPLOYEE,
        createdAt: toDate(employee.hireDate)
      },
      create: {
        id: userId,
        fullName: employee.fullName,
        phone: `07${employee.id.slice(1).padStart(8, "0")}`,
        passwordHash,
        role: employee.role === "ADMIN" || employee.role === "MANAGER" ? Role.ADMIN : Role.EMPLOYEE,
        createdAt: toDate(employee.hireDate)
      }
    });

    await prisma.employee.upsert({
      where: { id: employee.id },
      update: {
        userId,
        nationalIdHash: `mock-hash-${employee.id}`,
        nationalIdEncrypted: `enc-${employee.id}-nid`,
        birthDateEncrypted: "enc-1990-01-01",
        jobTitleEncrypted: `enc-${employee.role}`,
        defaultSalaryEncrypted: `enc-${employee.salary}`,
        workScheduleEncrypted: "enc-sun-thu-9-18",
        jobTitle: employee.role,
        monthlyBase: employee.salary,
        hiredAt: toDate(employee.hireDate),
        isActive: true,
        createdByAdminId: admin.id
      },
      create: {
        id: employee.id,
        userId,
        nationalIdHash: `mock-hash-${employee.id}`,
        nationalIdEncrypted: `enc-${employee.id}-nid`,
        birthDateEncrypted: "enc-1990-01-01",
        jobTitleEncrypted: `enc-${employee.role}`,
        defaultSalaryEncrypted: `enc-${employee.salary}`,
        workScheduleEncrypted: "enc-sun-thu-9-18",
        jobTitle: employee.role,
        monthlyBase: employee.salary,
        hiredAt: toDate(employee.hireDate),
        isActive: true,
        createdByAdminId: admin.id
      }
    });
  }

  for (const service of mock.services) {
    await prisma.service.upsert({
      where: { id: service.id },
      update: {
        nameEn: service.name,
        nameAr: service.name,
        category: service.category,
        basePrice: service.basePrice,
        durationMinutes: service.durationMin,
        isActive: true
      },
      create: {
        id: service.id,
        nameEn: service.name,
        nameAr: service.name,
        category: service.category,
        basePrice: service.basePrice,
        durationMinutes: service.durationMin,
        isActive: true
      }
    });
  }

  for (const item of mock.inventoryItems) {
    await prisma.part.upsert({
      where: { id: item.id },
      update: {
        name: item.itemName,
        sku: `SKU-${item.id}`,
        vehicleType: item.carType,
        vehicleModel: "Mixed",
        category: item.carType,
        unit: "piece",
        costPrice: item.cost,
        sellPrice: item.defaultSellingPrice,
        stockQty: item.currentQuantity,
        lowStockThreshold: item.minimumQuantity,
        isActive: true
      },
      create: {
        id: item.id,
        name: item.itemName,
        sku: `SKU-${item.id}`,
        vehicleType: item.carType,
        vehicleModel: "Mixed",
        category: item.carType,
        unit: "piece",
        costPrice: item.cost,
        sellPrice: item.defaultSellingPrice,
        stockQty: item.currentQuantity,
        lowStockThreshold: item.minimumQuantity,
        isActive: true
      }
    });
  }

  const technicianIds = mock.employees.filter((item) => item.role === "TECHNICIAN").map((item) => item.id);

  for (const [index, booking] of mock.bookings.entries()) {
    const appointmentAt = toDate(booking.bookingDate);
    const service = mock.services.find((item) => item.id === booking.serviceId);
    if (!service) continue;

    const performedByEmployeeId =
      toBookingStatus(booking.status) === BookingStatus.COMPLETED && technicianIds.length
        ? technicianIds[index % technicianIds.length]
        : null;

    await prisma.booking.upsert({
      where: { id: booking.bookingId },
      update: {
        customerId: booking.customerId,
        createdByUserId: admin.id,
        serviceId: booking.serviceId,
        branchId: "MAIN",
        slotDate: appointmentAt.toISOString().slice(0, 10),
        slotTime: appointmentAt.toISOString().slice(11, 16),
        appointmentAt,
        status: toBookingStatus(booking.status),
        notes: `Vehicle ${booking.vehicleId}`,
        finalPrice: booking.finalPrice,
        performedByEmployeeId,
        serviceNameSnapshotEn: service.name,
        serviceNameSnapshotAr: service.name,
        serviceCategorySnapshot: service.category,
        serviceBasePriceSnapshot: service.basePrice,
        completedAt: toBookingStatus(booking.status) === BookingStatus.COMPLETED ? appointmentAt : null,
        internalNote: toBookingStatus(booking.status) === BookingStatus.COMPLETED ? "Completed during mock import." : null
      },
      create: {
        id: booking.bookingId,
        customerId: booking.customerId,
        createdByUserId: admin.id,
        serviceId: booking.serviceId,
        branchId: "MAIN",
        slotDate: appointmentAt.toISOString().slice(0, 10),
        slotTime: appointmentAt.toISOString().slice(11, 16),
        appointmentAt,
        status: toBookingStatus(booking.status),
        notes: `Vehicle ${booking.vehicleId}`,
        finalPrice: booking.finalPrice,
        performedByEmployeeId,
        serviceNameSnapshotEn: service.name,
        serviceNameSnapshotAr: service.name,
        serviceCategorySnapshot: service.category,
        serviceBasePriceSnapshot: service.basePrice,
        completedAt: toBookingStatus(booking.status) === BookingStatus.COMPLETED ? appointmentAt : null,
        internalNote: toBookingStatus(booking.status) === BookingStatus.COMPLETED ? "Completed during mock import." : null,
        createdAt: appointmentAt
      }
    });
  }

  for (const invoice of mock.saleInvoices) {
    const issueDate = toDate(invoice.invoiceDate);
    await prisma.invoice.upsert({
      where: { id: invoice.invoiceId },
      update: {
        number: invoice.invoiceNumber,
        type: InvoiceType.SALE,
        status: InvoiceStatus.PAID,
        totalAmount: invoice.totalAmount,
        issueDate,
        paidAt: issueDate,
        note: `Customer ${invoice.customerId}`
      },
      create: {
        id: invoice.invoiceId,
        number: invoice.invoiceNumber,
        type: InvoiceType.SALE,
        status: InvoiceStatus.PAID,
        totalAmount: invoice.totalAmount,
        issueDate,
        paidAt: issueDate,
        note: `Customer ${invoice.customerId}`,
        createdAt: issueDate
      }
    });

    for (const [lineIndex, line] of invoice.items.entries()) {
      const inventoryItem = mock.inventoryItems.find((item) => item.id === line.itemId);
      const supplierId = inventoryItem ? supplierIdByName.get(inventoryItem.supplierName) : null;
      await prisma.invoiceLine.upsert({
        where: { id: `${invoice.invoiceId}_L${lineIndex + 1}` },
        update: {
          invoiceId: invoice.invoiceId,
          partId: line.itemId,
          supplierId: supplierId ?? undefined,
          lineType: InvoiceLineType.INVENTORY,
          description: line.itemName,
          quantity: line.quantity,
          unitAmount: line.sellingPrice,
          lineTotal: line.lineTotal,
          costSnapshot: inventoryItem?.cost ?? null,
          occurredAt: issueDate,
          createdById: admin.id
        },
        create: {
          id: `${invoice.invoiceId}_L${lineIndex + 1}`,
          invoiceId: invoice.invoiceId,
          partId: line.itemId,
          supplierId: supplierId ?? undefined,
          lineType: InvoiceLineType.INVENTORY,
          description: line.itemName,
          quantity: line.quantity,
          unitAmount: line.sellingPrice,
          lineTotal: line.lineTotal,
          costSnapshot: inventoryItem?.cost ?? null,
          occurredAt: issueDate,
          createdById: admin.id,
          createdAt: issueDate
        }
      });

      await prisma.stockMovement.upsert({
        where: { id: `${invoice.invoiceId}_SM${lineIndex + 1}` },
        update: {
          partId: line.itemId,
          type: StockMovementType.OUT,
          quantity: line.quantity,
          occurredAt: issueDate,
          note: `Sale ${invoice.invoiceNumber}`,
          createdById: admin.id,
          invoiceId: invoice.invoiceId
        },
        create: {
          id: `${invoice.invoiceId}_SM${lineIndex + 1}`,
          partId: line.itemId,
          type: StockMovementType.OUT,
          quantity: line.quantity,
          occurredAt: issueDate,
          note: `Sale ${invoice.invoiceNumber}`,
          createdById: admin.id,
          invoiceId: invoice.invoiceId,
          createdAt: issueDate
        }
      });
    }
  }

  for (const transaction of mock.transactions.filter((item) => item.type === "EXPENSE")) {
    const occurredAt = toDate(transaction.occurredAt);
    await prisma.expense.upsert({
      where: { id: `EXP_${transaction.transactionId}` },
      update: {
        amount: transaction.amount,
        note: transaction.description,
        createdById: admin.id,
        expenseCategory: mapExpenseCategory(transaction.source),
        expenseDate: occurredAt
      },
      create: {
        id: `EXP_${transaction.transactionId}`,
        amount: transaction.amount,
        note: transaction.description,
        createdById: admin.id,
        expenseCategory: mapExpenseCategory(transaction.source),
        expenseDate: occurredAt,
        createdAt: occurredAt
      }
    });
  }

  for (const transaction of mock.transactions) {
    const occurredAt = toDate(transaction.occurredAt);
    const linkedBooking = transaction.type === "INCOME" && transaction.source === "BOOKING" ? transaction.referenceId : null;
    const linkedInvoice = transaction.type === "INCOME" && transaction.source === "WALK_IN" ? transaction.referenceId : null;
    const linkedExpense = transaction.type === "EXPENSE" ? `EXP_${transaction.transactionId}` : null;
    const relatedLineCount = linkedInvoice
      ? mock.saleInvoices.find((item) => item.invoiceId === linkedInvoice)?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 1
      : 1;
    const unitPrice = transaction.amount / relatedLineCount;

    await prisma.transaction.upsert({
      where: { id: transaction.transactionId },
      update: {
        type: transaction.type === "INCOME" ? TransactionType.INCOME : TransactionType.EXPENSE,
        itemName: transaction.description,
        unitPrice,
        quantity: relatedLineCount,
        amount: transaction.amount,
        note: transaction.description,
        description: transaction.description,
        bookingId: linkedBooking ?? undefined,
        invoiceId: linkedInvoice ?? undefined,
        expenseId: linkedExpense ?? undefined,
        incomeSource: transaction.type === "INCOME" ? mapIncomeSource(transaction.source) : null,
        expenseCategory: transaction.type === "EXPENSE" ? mapExpenseCategory(transaction.source) : null,
        referenceType: transaction.source,
        referenceId: transaction.referenceId,
        occurredAt,
        recordedAt: occurredAt,
        createdById: admin.id
      },
      create: {
        id: transaction.transactionId,
        type: transaction.type === "INCOME" ? TransactionType.INCOME : TransactionType.EXPENSE,
        itemName: transaction.description,
        unitPrice,
        quantity: relatedLineCount,
        amount: transaction.amount,
        note: transaction.description,
        description: transaction.description,
        bookingId: linkedBooking ?? undefined,
        invoiceId: linkedInvoice ?? undefined,
        expenseId: linkedExpense ?? undefined,
        incomeSource: transaction.type === "INCOME" ? mapIncomeSource(transaction.source) : null,
        expenseCategory: transaction.type === "EXPENSE" ? mapExpenseCategory(transaction.source) : null,
        referenceType: transaction.source,
        referenceId: transaction.referenceId,
        occurredAt,
        recordedAt: occurredAt,
        createdById: admin.id,
        createdAt: occurredAt
      }
    });
  }

  console.log(
    JSON.stringify(
      {
        imported: {
          customers: mock.customers.length,
          services: mock.services.length,
          parts: mock.inventoryItems.length,
          bookings: mock.bookings.length,
          invoices: mock.saleInvoices.length,
          transactions: mock.transactions.length,
          employees: mock.employees.length
        }
      },
      null,
      2
    )
  );
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
