import { z } from "zod";

const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
const taskStatusSchema = z.enum(["TODO", "IN_PROGRESS", "DONE", "BLOCKED"]);
const employeeTaskStatusSchema = z.enum(["DONE", "BLOCKED"]);

const nullableText = z.string().trim().max(4000).nullable().optional();
const isoDate = z.string().datetime().optional();

export const createTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: nullableText,
    priority: taskPrioritySchema.default("MEDIUM"),
    dueAt: isoDate,
    assignedToId: z.string().trim().min(1)
  })
  .strict();

export const adminUpdateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: nullableText,
    priority: taskPrioritySchema.optional(),
    status: taskStatusSchema.optional(),
    dueAt: isoDate.nullable(),
    assignedToId: z.string().trim().min(1).optional(),
    createdById: z.string().trim().min(1).optional(),
    employeeNote: nullableText,
    adminNote: nullableText,
    adminPassword: z.string().min(8).max(128).optional()
  })
  .strict();

export const employeeUpdateTaskSchema = z
  .object({
    status: employeeTaskStatusSchema.optional(),
    employeeNote: nullableText
  })
  .strict()
  .refine((value) => value.status !== undefined && typeof value.employeeNote === "string" && value.employeeNote.trim().length > 0, {
    message: "Provide a final status and employee note."
  });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type AdminUpdateTaskInput = z.infer<typeof adminUpdateTaskSchema>;
export type EmployeeUpdateTaskInput = z.infer<typeof employeeUpdateTaskSchema>;
