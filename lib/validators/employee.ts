import { z } from "zod";

export const employeeRoleProfileSchema = z.enum([
  "ADMIN",
  "MANAGER",
  "RECEPTION",
  "ACCOUNTANT",
  "TECHNICIAN",
  "EMPLOYEE"
]);

export const employmentTypeSchema = z.enum(["FULL_TIME", "PART_TIME", "CONTRACT"]);
export const employmentStatusSchema = z.enum(["ACTIVE", "ON_LEAVE"]);
export const employeeDepartmentSchema = z.enum([
  "OPERATIONS",
  "HR",
  "FINANCE",
  "FRONT_DESK",
  "TECHNICAL_SERVICE",
  "INVENTORY",
  "CUSTOMER_SUPPORT"
]);

const permissionSchema = z.enum([
  "accounting",
  "warehouse",
  "bookings",
  "hr",
  "memberships",
  "analytics",
  "services"
]);

export const createEmployeeSchema = z.object({
  phone: z.string().trim().regex(/^07\d{8}$/, "Phone must start with 07 and contain 10 digits."),
  fullName: z.string().min(2).max(120),
  nationalId: z.string().min(6).max(64),
  birthDate: z.coerce.date(),
  jobTitle: z.string().min(2).max(120),
  idCardImageUrl: z.string().min(1).max(1000),
  profilePhotoUrl: z.string().min(1).max(1000),
  permissions: z.array(permissionSchema).default([]),
  defaultSalaryInfo: z.record(z.any()).default({}),
  workSchedule: z.record(z.any()).default({})
});

export const updateEmployeePermissionsSchema = z.object({
  permissions: z.array(permissionSchema)
});

export const updateEmployeeHrSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  nationalId: z.string().min(6).max(64).optional(),
  birthDate: z.coerce.date().optional(),
  jobTitle: z.string().min(2).max(120).optional(),
  idCardImageUrl: z.string().min(1).max(1000).optional(),
  profilePhotoUrl: z.string().min(1).max(1000).optional(),
  defaultSalaryInfo: z.record(z.any()).optional(),
  workSchedule: z.record(z.any()).optional()
});

export const employeePermissionOverrideSchema = z.object({
  canManageBookings: z.boolean(),
  canAccessAccounting: z.boolean(),
  canEditInventory: z.boolean(),
  canManageEmployees: z.boolean(),
  canViewReports: z.boolean(),
  canIssueRefunds: z.boolean()
});

export const employeeProfileUpdateSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().trim().regex(/^07\d{8}$/, "Phone must start with 07 and contain 10 digits.").optional(),
  jobTitle: z.string().min(2).max(120).optional(),
  department: employeeDepartmentSchema.nullable().optional(),
  employmentType: employmentTypeSchema.optional(),
  startDate: z.coerce.date().nullable().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "BANNED", "ON_LEAVE"]).optional(),
  emergencyContact: z.string().max(120).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  avatarUrl: z.string().max(1000).nullable().optional()
});

export const employeePermissionsUpdateSchema = z.object({
  roleProfile: employeeRoleProfileSchema,
  overrides: employeePermissionOverrideSchema
});

export const employeeHrAdminUpdateSchema = z.object({
  salary: z.coerce.number().min(0).nullable().optional(),
  paymentFrequency: z.string().max(80).nullable().optional(),
  bonusHistory: z.array(z.record(z.any())).optional(),
  deductions: z.array(z.record(z.any())).optional(),
  leaveBalance: z
    .object({
      annual: z.coerce.number().min(0).default(0),
      sick: z.coerce.number().min(0).default(0)
    })
    .optional(),
  internalNotes: z.string().max(2000).nullable().optional()
});

export const attendanceScanSchema = z.object({
  employeeId: z.string().min(1),
  qrPayload: z.string().min(10),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  geoNote: z.string().max(160).optional()
});

export const salaryPaymentSchema = z.object({
  employeeId: z.string().min(1),
  amount: z.coerce.number().min(0),
  periodMonth: z.coerce.number().int().min(1).max(12),
  periodYear: z.coerce.number().int().min(2024).max(2200),
  markPaid: z.boolean().default(true),
  note: z.string().max(500).optional(),
  occurredAt: z.coerce.date().optional()
});
