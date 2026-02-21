# Migration Plan

## 1) Foundation Migration
- Create base security and identity tables: `User`, `Employee`, and enums for RBAC roles.
- Create core center configuration: `SystemSetting`, `AboutSettings`, `WorkingHour`.

## 2) Service and Booking Domain
- Add service catalog tables: `Service`, `Offer`, `OfferService`.
- Add booking lifecycle tables: `Booking`, `BookingSlotLock`, `BookingServiceAssignment`.
- Add constraints for lock uniqueness (`serviceId + appointmentAt`) and simplified booking status flow.

## 3) Accounting Domain
- Create financial entities: `Transaction`, `Expense`, `Supplier`, `Invoice`.
- Enforce one-to-one links for `Transaction.bookingId` and `Transaction.expenseId`.
- Preserve income source separation via `IncomeSource` enum.

## 4) Membership Domain
- Add `MembershipPlan`, `MembershipPlanService`, `MembershipOrder`, `MembershipUsage`.
- Preserve price snapshot on order creation and entitlement usage history.

## 5) Employee Ops Domain
- Add attendance and payroll tables: `Attendance`, `SalaryPayment`, `EmployeeService`.
- Add attendance indexes for reporting performance.

## 6) Customer Feedback and Messaging
- Create `Review` moderation table.
- Create chat polling model: `ChatThread`, `ChatParticipant`, `ChatMessage`, `ChatMessageSeen`.

## 7) Governance and Reliability
- Add `Notification`, `AuditLog`, `Backup`.
- Add backup retention process at application layer (keep latest 30 backup records/files).

## Deployment Order
1. Run `prisma migrate dev --name init`.
2. Run `prisma generate`.
3. Run seed via `npm run db:seed`.
4. For production, run `prisma migrate deploy` in CI/CD.

## Booking Status + Dynamic Pricing Upgrade
- Migration file: `prisma/migrations/20260221_booking_status_dynamic_pricing/migration.sql`.
- Converts booking statuses:
  - `CONFIRMED` -> `APPROVED`
  - `IN_PROGRESS` -> `APPROVED`
  - `CANCELED` -> `REJECTED`
- Removes service and booking snapshot pricing columns.
- Adds booking completion pricing columns (`finalPrice`, `adminInternalNote`, `linkedEmployeeId`, `rejectReason`).
