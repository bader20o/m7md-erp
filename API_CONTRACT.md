# API Contract (v1)

Base path: `/api`

Response envelope:
- Success: `{ success: true, data: ... }`
- Error: `{ success: false, error: { code, message, details? } }`

## Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

## Services
- `GET /services`
- `POST /services` (manager/admin)
- `GET /services/:id`
- `PATCH /services/:id` (manager/admin)

Service payloads expose only:
- `nameEn`, `nameAr`
- `descriptionEn`, `descriptionAr`
- `durationMinutes`
- `isActive`

No service price fields are accepted or returned.

## Bookings (Customer)
- `GET /bookings`
- `POST /bookings`
  - Body: `{ serviceId, appointmentAt, notes? }`
  - Always creates booking with `status = PENDING`
  - Does not accept or return price fields
- `POST /bookings/:id/assign-employee` (reception/manager/admin)

Deprecated endpoints:
- `POST /bookings/:id/cancel` -> returns `410 ENDPOINT_REMOVED`
- `POST /bookings/:id/complete` -> returns `410 ENDPOINT_MOVED`

## Admin Bookings
- `GET /admin/bookings`
- `POST /admin/bookings/:id/approve`
  - Sets `status = APPROVED`
- `POST /admin/bookings/:id/reject`
  - Body: `{ rejectReason }` (required)
  - Sets `status = REJECTED`
- `POST /admin/bookings/:id/complete`
  - Body: `{ finalPrice, adminInternalNote?, linkedEmployeeId? }`
  - `finalPrice` required and must be `> 0`
  - Sets `status = COMPLETED`
  - Creates accounting `INCOME` transaction:
    - `incomeSource = APP_BOOKING`
    - `amount = finalPrice`
    - `bookingId = :id`
- `POST /admin/bookings/:id/no-show`
  - Sets `status = NO_SHOW`
  - No accounting transaction is created

Booking status enum values are only:
- `PENDING`
- `APPROVED`
- `REJECTED`
- `COMPLETED`
- `NO_SHOW`

## Accounting
- `GET /accounting/transactions`
- `POST /accounting/walkin-income`
- `GET /accounting/expenses`
- `POST /accounting/expenses`
- `GET /accounting/reports/summary`

Report behavior:
- App booking income is computed from completed bookings `finalPrice` only.
- Walk-in and membership income are computed from transactions by source.

## Other Implemented Domains
- Suppliers: `/suppliers`
- Invoices: `/invoices`
- Memberships: `/memberships/plans`, `/memberships/orders`, `/memberships/orders/:id/use-entitlement`
- Employees: `/employees`, `/employees/attendance`, `/employees/salaries`
- Reviews: `/reviews`, `/reviews/:id/moderate`
- About + Settings: `/about`, `/working-hours`, `/system/settings`
- Offers: `/offers`, `/offers/:id`
- Notifications: `/notifications`, `/notifications/:id/seen`
- Chat (polling): `/chat/threads`, `/chat/messages`
- Audit logs: `/system/audit-logs`
- Backups: `/backups`, `/backups/manual`
- Uploads: `/uploads/presigned-url`, `/uploads/local`
