# Hybrid & Electric Car Service Center Platform

Production-oriented monorepo scaffold using:
- Next.js (App Router) + TypeScript + Tailwind
- PostgreSQL + Prisma
- RBAC with roles: `CUSTOMER`, `EMPLOYEE`, `RECEPTION`, `ACCOUNTANT`, `MANAGER`, `ADMIN`

## Implemented Scope
- Phone/password auth (`/api/auth/*`) with session cookie
- Booking lifecycle with:
  - slot locking (`BookingSlotLock`)
  - simplified status model: `PENDING`, `APPROVED`, `REJECTED`, `COMPLETED`, `NO_SHOW`
  - customer booking creation without price snapshot
  - admin completion with required `finalPrice`
  - completion to accounting income transaction linked by `bookingId`
- Accounting:
  - app booking income from completed bookings `finalPrice`
  - walk-in income
  - membership income
  - expenses with supplier, note, and invoice grouping
- Memberships:
  - plans, orders, entitlement usage tracking
- Employees:
  - employee records
  - QR attendance check-in/check-out
  - salary payments
  - booking-service assignment by employee
- Reviews moderation
- Public About + working hours + system settings
- Notifications
- Audit logs
- Backups:
  - manual API trigger
  - scriptable daily job
  - retention pruning (keep latest 30 successful)
- AR/EN locale routes with RTL/LTR switching
- Admin sidebar grouped exactly per required sections

## Project Structure
- `app/` App Router pages + API route handlers
- `prisma/schema.prisma` data model
- `prisma/seed.ts` initial data + admin bootstrap
- `docs/MIGRATION_PLAN.md` migration sequencing
- `lib/` auth, RBAC, validation, backup, audit, helpers
- `components/` UI components
- `scripts/` backup jobs

## Quick Start

1. Copy environment:
```bash
cp .env.example .env
```

2. Start infrastructure:
```bash
docker compose up -d
```

3. Install dependencies:
```bash
npm install
```

4. Generate and migrate:
```bash
npm run db:generate
npx prisma db push
```

If you are upgrading an older local DB, apply the migration script:
```bash
npx prisma migrate deploy
```

5. Seed:
```bash
npm run db:seed
```

6. Start app:
```bash
npm run dev
```

## SQLite Fallback (When PostgreSQL Fails)

If PostgreSQL is unavailable, you can run locally with SQLite.

1. Stop the dev server if it is running.
2. Initialize SQLite schema + client + seed:
```bash
npm run db:sqlite:init
```
3. Start app:
```bash
npm run dev
```

Notes:
- SQLite DB file is `prisma/dev.db` (with `DATABASE_URL_SQLITE="file:./dev.db"`).
- `npm run db:sqlite:init` resets `prisma/dev.db` before recreating schema and seed data.
- This fallback regenerates `@prisma/client` for SQLite. To switch back, run:
```bash
npm run db:generate
```

## Default Admin (seeded)
- Phone: value of `DEFAULT_ADMIN_PHONE` (default: `+15550000000`)
- Password: value of `DEFAULT_ADMIN_PASSWORD` (default: `ChangeMe123!`)
- No public admin registration is enabled.

## Backup Operations

Manual backup via API (manager/admin session required):
```http
POST /api/backups/manual
```

Manual backup via script:
```bash
npm exec tsx scripts/run-backup.ts
```

Daily looped backup worker:
```bash
npm exec tsx scripts/daily-backup.ts
```

Notes:
- Uses `pg_dump` command; ensure PostgreSQL client tools are installed in runtime environment.
- Records metadata in `Backup` table.
- Prunes old successful backups beyond configured retention count (`BACKUP_RETENTION_COUNT`, default `30`).

## API Summary
- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- Services: `/api/services`, `/api/services/:id`
- Bookings: `/api/bookings`, `/api/bookings/:id/assign-employee`
- Admin bookings/users: `/api/admin/bookings`, `/api/admin/users`
  - Booking actions: `/api/admin/bookings/:id/approve`, `/api/admin/bookings/:id/reject`, `/api/admin/bookings/:id/complete`, `/api/admin/bookings/:id/no-show`
- Accounting: `/api/accounting/transactions`, `/api/accounting/walkin-income`, `/api/accounting/expenses`, `/api/accounting/reports/summary`
- Suppliers/Invoices: `/api/suppliers`, `/api/invoices`
- Memberships: `/api/memberships/plans`, `/api/memberships/orders`, `/api/memberships/orders/:id/use-entitlement`
- Employees: `/api/employees`, `/api/employees/attendance`, `/api/employees/attendance/qr`, `/api/employees/attendance/checkin`, `/api/employees/salaries`
- Reviews: `/api/reviews`, `/api/reviews/:id/moderate`
- Center: `/api/about`, `/api/working-hours`, `/api/system/settings`
- Offers: `/api/offers`, `/api/offers/:id`
- Chat: `/api/chat/threads`, `/api/chat/messages`
- Notifications: `/api/notifications`, `/api/notifications/:id/seen`
- System: `/api/system/audit-logs`, `/api/backups`, `/api/backups/manual`, `/api/uploads/presigned-url`, `/api/uploads/local`

## Notes
- Upload supports local device images for offers via `/api/uploads/local` and still includes placeholder presigned flow via `/api/uploads/presigned-url`.
- API handlers use Zod validation and a unified error format (`lib/api.ts`).
- Sensitive actions write audit logs where implemented.
