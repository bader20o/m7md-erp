# Database Schema (Prisma / PostgreSQL)

Canonical source of truth: `prisma/schema.prisma`

## Core Enums

### Role
- `CUSTOMER`
- `EMPLOYEE`
- `RECEPTION`
- `ACCOUNTANT`
- `MANAGER`
- `ADMIN`

### BookingStatus
- `PENDING`
- `APPROVED`
- `REJECTED`
- `COMPLETED`
- `NO_SHOW`

### TransactionType
- `INCOME`
- `EXPENSE`

### IncomeSource
- `APP_BOOKING`
- `WALK_IN`
- `MEMBERSHIP`

## Core Models

### `Service`
- `id`
- `nameEn`, `nameAr`
- `descriptionEn`, `descriptionAr`
- `durationMinutes`
- `isActive`
- `createdAt`, `updatedAt`

No price fields exist on `Service`.

### `Booking`
- `id`
- `customerId` -> `User`
- `serviceId` -> `Service`
- `appointmentAt`
- `status` (`BookingStatus`)
- `notes`
- `rejectReason` (nullable)
- `finalPrice` (nullable, decimal)
- `adminInternalNote` (nullable)
- `linkedEmployeeId` (nullable) -> `Employee`
- `completedAt` (nullable)
- `createdAt`, `updatedAt`

Removed booking pricing/cancellation snapshot fields:
- `servicePriceSnapshot`
- `currency`
- `cancellationReason`
- `isLateCancellation`
- `canceledAt`
- `canceledById`

### `Transaction`
- `id`
- `type` (`INCOME | EXPENSE`)
- `amount` (decimal)
- `incomeSource` (`APP_BOOKING | WALK_IN | MEMBERSHIP`, nullable for expenses)
- `bookingId` (nullable, unique)
- `expenseId` (nullable, unique)
- `membershipOrderId` (nullable)
- `recordedAt`
- `createdById` (nullable)

Rule:
- `COMPLETED` bookings create one `INCOME` transaction with `incomeSource = APP_BOOKING` and `bookingId` linked.

## Other Domains (present in schema)
- `User`, `Employee`, `EmployeeService`, `Attendance`, `SalaryPayment`
- `BookingSlotLock`, `BookingServiceAssignment`
- `Supplier`, `Expense`, `Invoice`
- `MembershipPlan`, `MembershipPlanService`, `MembershipOrder`, `MembershipUsage`
- `Review`
- `Offer`, `OfferService`
- `AboutSettings`, `WorkingHour`, `SystemSetting`
- `Notification`, `AuditLog`, `Backup`
- `ChatThread`, `ChatParticipant`, `ChatMessage`, `ChatMessageSeen`

## Integrity Rules Implemented in API Layer
- Booking creation defaults to `PENDING`.
- Reject requires `rejectReason`.
- Completion requires `finalPrice > 0`.
- App-booking income reporting uses completed booking `finalPrice` aggregates.
- Slot locking prevents double booking for active booking states.
