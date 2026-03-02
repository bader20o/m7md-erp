import { Role, BookingStatus, UserStatus } from "@prisma/client";
import { ApiError, fail, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requireRoles } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Params): Promise<Response> {
    try {
        requireRoles(await getSession(), [Role.ADMIN]);
        const { id } = await context.params;

        const employee = await prisma.employee.findUnique({
            where: { id },
            include: {
                user: true
            }
        });

        if (!employee || employee.user.role !== Role.EMPLOYEE) {
            throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
        }

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        // 1. Calculate Inactivity Days
        const lastAttendance = await prisma.attendance.findFirst({
            where: { employeeId: id },
            orderBy: { checkInAt: "desc" }
        });

        const lastBooking = await prisma.booking.findFirst({
            where: { performedByEmployeeId: id, status: BookingStatus.COMPLETED },
            orderBy: { completedAt: "desc" }
        });

        const lastAudit = await prisma.auditLog.findFirst({
            where: { actorId: employee.userId },
            orderBy: { createdAt: "desc" }
        });

        // Find the max date among last check-in, last booking completion, and last audit log
        const lastActivityDates = [
            lastAttendance?.checkInAt,
            lastBooking?.completedAt,
            lastAudit?.createdAt
        ].filter(Boolean) as Date[];

        const lastActivityDate = lastActivityDates.length
            ? new Date(Math.max(...lastActivityDates.map(d => d.getTime())))
            : null;

        let inactivityDays = -1;
        if (lastActivityDate) {
            inactivityDays = Math.floor((now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24));
        }

        // 2. Calculate Attendance Rate (last 30 days)
        const recentAttendance = await prisma.attendance.findMany({
            where: {
                employeeId: id,
                checkInAt: { gte: thirtyDaysAgo }
            },
            select: { checkInAt: true }
        });
        const presentDaysSet = new Set(recentAttendance.map(a => a.checkInAt.toISOString().slice(0, 10)));
        // Assume 22 working days max in a month roughly
        const workingDaysInPeriod = 22;
        const attendanceRate = Math.min(100, Math.round((presentDaysSet.size / workingDaysInPeriod) * 100));

        // 3. Calculate Revenue Trend
        const recentBookings = await prisma.booking.findMany({
            where: {
                performedByEmployeeId: id,
                status: BookingStatus.COMPLETED,
                completedAt: { gte: thirtyDaysAgo }
            }
        });

        const previousBookings = await prisma.booking.findMany({
            where: {
                performedByEmployeeId: id,
                status: BookingStatus.COMPLETED,
                completedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }
            }
        });

        const currentRevenue = recentBookings.reduce((sum, b) => sum + Number(b.finalPrice || 0), 0);
        const prevRevenue = previousBookings.reduce((sum, b) => sum + Number(b.finalPrice || 0), 0);

        let revenueTrend = 0;
        if (prevRevenue > 0) {
            revenueTrend = Math.round(((currentRevenue - prevRevenue) / prevRevenue) * 100);
        } else if (currentRevenue > 0) {
            revenueTrend = 100; // if prev was 0 and now has revenue
        }

        // 4. Performance Score (Heuristic: Mix of booking completion rate and attendance)
        const allRecentAssigned = await prisma.booking.findMany({
            where: {
                performedByEmployeeId: id,
                appointmentAt: { gte: thirtyDaysAgo, lt: now }
            }
        });

        let bookingCompletionRate = 100;
        if (allRecentAssigned.length > 0) {
            const completedCount = allRecentAssigned.filter(b => b.status === BookingStatus.COMPLETED).length;
            bookingCompletionRate = Math.round((completedCount / allRecentAssigned.length) * 100);
        }

        // 4b. Task Performance Metrics
        const allAssignedTasks = await prisma.task.findMany({
            where: {
                assignedToId: employee.userId,
                createdAt: { gte: thirtyDaysAgo }
            }
        });

        let taskCompletionRate = 100;
        let taskOverdueRate = 0;
        if (allAssignedTasks.length > 0) {
            const completedTasks = allAssignedTasks.filter((t) => t.status === "DONE").length;
            const overdueTasks = allAssignedTasks.filter(
                (t) => t.status !== "DONE" && t.dueAt && new Date(t.dueAt) < now
            ).length;

            taskCompletionRate = Math.round((completedTasks / allAssignedTasks.length) * 100);
            taskOverdueRate = Math.round((overdueTasks / allAssignedTasks.length) * 100);
        }

        // Overall Performance Score: 30% Attendance + 35% Bookings + 35% Tasks
        let performanceScore = Math.round((attendanceRate * 0.30) + (bookingCompletionRate * 0.35) + (taskCompletionRate * 0.35) - (taskOverdueRate * 0.20));
        if (isNaN(performanceScore)) performanceScore = 0;
        if (performanceScore < 0) performanceScore = 0;
        if (performanceScore > 100) performanceScore = 100;

        // 5. Build Flags and derive Risk Level
        const flags: string[] = [];
        let riskLevel = "Healthy";

        if (employee.user.status === UserStatus.SUSPENDED) {
            riskLevel = "Critical";
            flags.push("Account is suspended.");
        } else if (employee.user.status === UserStatus.BANNED) {
            riskLevel = "Critical";
            flags.push("Account is banned.");
        } else {
            if (inactivityDays > 7) {
                flags.push(`No activity for ${inactivityDays} days.`);
            }

            if (attendanceRate < 70) {
                flags.push(`Low attendance rate (${attendanceRate}%).`);
            }

            if (revenueTrend < -20) {
                flags.push(`Revenue dropped by ${Math.abs(revenueTrend)}% vs last period.`);
            }

            if (bookingCompletionRate < 60 && allRecentAssigned.length > 5) {
                flags.push(`Low booking completion rate (${bookingCompletionRate}%).`);
            }

            if (taskCompletionRate < 50 && allAssignedTasks.length > 2) {
                flags.push(`Low task resolution rate (${taskCompletionRate}%).`);
            }

            if (taskOverdueRate > 30) {
                flags.push(`High overdue task rate (${taskOverdueRate}%).`);
            }

            if (flags.length >= 3 || inactivityDays > 14 || employee.user.status !== UserStatus.ACTIVE || taskOverdueRate > 50) {
                riskLevel = "Critical";
            } else if (flags.length === 1 || inactivityDays > 3) {
                riskLevel = "Warning";
            }
        }

        return ok({
            item: {
                performanceScore,
                attendanceRate,
                revenueTrend,
                riskLevel,
                inactivityDays,
                flags
            }
        });
    } catch (error) {
        return fail(error);
    }
}
