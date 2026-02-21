# TECH_STACK.md

## Target
Build a Web Application (mobile-ready UI) for a Hybrid & Electric Car Service Center.
Single system that includes bookings + accounting + employees + memberships + reports.

## Recommended Stack (cohesive, production-friendly)
- Frontend: Next.js (App Router) + TypeScript + TailwindCSS
- Backend: Next.js Route Handlers (REST API) OR Express inside /server (choose one; prefer Next.js Route Handlers for simplicity)
- Database: PostgreSQL
- ORM: Prisma
- Auth: Phone + Password (hashed with bcrypt) + JWT (httpOnly cookies)
- Optional Phone Verification (OTP): Twilio (or local SMS gateway)
- File Storage (profile images/review images/service images): S3-compatible (AWS S3 / Cloudflare R2) OR Firebase Storage
- Realtime Chat: Socket.io (WebSocket)
- Background Jobs: BullMQ + Redis (for reminders, scheduled reports, backup triggers)
- Validation: Zod
- Logging: Pino
- Charts: Recharts (frontend)

## Environments
- Dev: Docker compose (postgres + redis)
- Prod: Managed Postgres + Redis

## Key Non-Functional Requirements
- Role-based access control (RBAC) for Admin/Manager/Accountant/Reception/Employee/Customer
- Audit logs for all critical actions
- Backup system (daily automatic + manual export + restore)
- Slot locking to prevent double booking (transaction-safe)
- Multi-language support (Arabic/English), RTL/LTR
## Frontend
- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS

## Backend
- Next.js Route Handlers (`app/api`)
- Zod validation for request payloads
- JWT session cookies (custom auth with `jose`)
- RBAC guards (`CUSTOMER`, `EMPLOYEE`, `RECEPTION`, `ACCOUNTANT`, `MANAGER`, `ADMIN`)

## Database
- PostgreSQL
- Prisma ORM

## Infra
- Docker Compose for:
  - PostgreSQL
  - Redis (reserved for cache/queues/realtime scale)

## Operations
- Audit logging for sensitive actions
- Backup metadata in DB + `pg_dump` job scripts
- Backup retention policy (latest 30 successful backups)
