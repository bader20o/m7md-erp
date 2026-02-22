# FRONTEND_INTEGRATION_SPEC

Generated from backend code audit of this repository on **2026-02-22**.

This spec is implementation-accurate for the current backend and is intended for your Antigravity SPA frontend integration.

## 1) Authentication & Session

### Auth method used
- Auth is **custom JWT session auth**.
- JWT is signed server-side (`HS256`) and stored in an **httpOnly cookie** named `session_token`.
- Session TTL: **7 days**.
- Token is **not exposed to JS** (httpOnly), so frontend should not try to read/store JWT manually.

### Session/user identity endpoints
- `POST /api/auth/login`
  - Body: `{ phone, password }`
  - On success: sets `session_token` cookie and returns user summary.
- `GET /api/auth/me`
  - Returns `{ user: null }` when not logged in (200), otherwise logged-in user object.
- `POST /api/auth/logout`
  - Clears session cookie.
- `POST /api/auth/register`
  - Creates customer user and sets session cookie.

### How frontend attaches auth
- Use cookie-based auth.
- Same-origin frontend: browser sends cookie automatically.
- Cross-origin frontend: requests must include `credentials: "include"`.
- **Do not use Bearer tokens**; backend auth checks cookie session.

### Roles and permissions
Roles in backend enum:
- `CUSTOMER`
- `EMPLOYEE`
- `RECEPTION`
- `ACCOUNTANT`
- `MANAGER`
- `ADMIN`

Permission map (effective):
- `CUSTOMER`: none
- `EMPLOYEE`: `attendance.own`
- `RECEPTION`: `bookings.walkin`, `bookings.manage`, `customers.manage`, `attendance.manage`, `ledger.write`
- `ACCOUNTANT`: `ledger.read`, `ledger.write`, `reports.read`, `suppliers.manage`, `invoices.manage`, `salaries.manage`
- `MANAGER`: broad operations (bookings, reviews moderation, memberships, attendance/salaries, services/offers/about/hours, ledger/reports, suppliers/invoices)
- `ADMIN`: all permissions

### How frontend detects role
- Source of truth: `GET /api/auth/me` => `data.user.role`.
- Do not infer role from UI state alone.

## 2) Base API Configuration

### Base URL
- Dev (same app): `http://localhost:3000/api`
- Prod (same app): `https://<your-domain>/api`
- Recommended frontend API base: `"/api"` (same-origin relative path).

### CORS expectations
- No explicit CORS policy is configured in route handlers.
- Current backend is designed for same-origin usage.
- If frontend is hosted on a different origin, backend CORS headers will be required.

### Standard response envelope
Most JSON endpoints return:

```json
{
  "success": true,
  "data": {}
}
```

Errors return:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": []
  }
}
```

Another example:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission for this resource.",
    "details": null
  }
}
```

### Pagination format
- No global pagination standard across resources.
- Most list endpoints return capped lists (`take` server-side).
- Chat messages support cursor pagination:
  - Request: `GET /api/chat/messages?threadId=...&take=50&cursor=<messageId>`
  - Response includes `nextCursor`.

### Date format and timezone rules
- Date range filters for analytics/export require `YYYY-MM-DD`.
- Backend parses date-only values as **UTC day start**.
- Range end is inclusive (to day end `23:59:59.999Z`).
- Datetime fields in responses are ISO strings (UTC), e.g. `2026-02-22T10:30:00.000Z`.

### Numeric serialization notes
- Prisma `Decimal` fields returned directly from models serialize as strings in JSON (typical), e.g. `"125.00"`.
- Analytics and computed payloads explicitly return numbers.

## 3) REST Endpoints Inventory (with examples)

All endpoint responses below are wrapped in `{ success, data }` unless stated otherwise.

### 3.1 Services

| Method | Path | Query | Body | Auth/Roles |
|---|---|---|---|---|
| GET | `/api/services` | none | none | Public |
| POST | `/api/services` | none | `nameEn,nameAr,descriptionEn?,descriptionAr?,durationMinutes` | `ADMIN`,`MANAGER` |
| GET | `/api/services/:id` | none | none | Public |
| PATCH | `/api/services/:id` | none | Any subset of editable fields (`nameEn`,`nameAr`,`descriptionEn`,`descriptionAr`,`durationMinutes`,`isActive`) | `ADMIN`,`MANAGER` |

Example response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "svc_123",
        "nameEn": "Battery Diagnostic",
        "nameAr": "فحص البطارية",
        "category": "Electrical",
        "basePrice": "40.00",
        "descriptionEn": "Full battery health scan",
        "descriptionAr": "فحص شامل لصحة البطارية",
        "durationMinutes": 45,
        "isActive": true,
        "createdAt": "2026-02-01T10:00:00.000Z",
        "updatedAt": "2026-02-01T10:00:00.000Z"
      }
    ]
  }
}
```

### 3.2 Bookings

| Method | Path | Query | Body | Auth/Roles |
|---|---|---|---|---|
| GET | `/api/bookings` | none | none | Logged-in users (role-specific visibility) |
| POST | `/api/bookings` | none | `serviceId,appointmentAt,notes?,customerId?,branchId?` | `CUSTOMER`,`RECEPTION`,`MANAGER`,`ADMIN` |
| POST | `/api/bookings/:id/cancel` | none | `cancelReason` | `RECEPTION`,`MANAGER`,`ADMIN` |
| POST | `/api/bookings/:id/assign-employee` | none | `employeeId,serviceId?,note?` | `RECEPTION`,`MANAGER`,`ADMIN` |
| POST | `/api/bookings/:id/complete` | none | none | Deprecated (returns 410; use admin endpoint) |

Admin booking status endpoints:
- `GET /api/admin/bookings`
- `POST /api/admin/bookings/:id/approve`
- `POST /api/admin/bookings/:id/reject` body: `{ rejectReason }`
- `POST /api/admin/bookings/:id/cancel` body: `{ cancelReason }`
- `POST /api/admin/bookings/:id/late-cancel` body: `{ cancelReason }`
- `POST /api/admin/bookings/:id/no-show`
- `POST /api/admin/bookings/:id/not-served`
- `POST /api/admin/bookings/:id/complete` body: `{ finalPrice, internalNote?, performedByEmployeeId? }`

Example create booking request body:

```json
{
  "serviceId": "svc_123",
  "appointmentAt": "2026-02-23T09:30:00.000Z",
  "notes": "Customer asked for quick check",
  "branchId": "MAIN"
}
```

Example create booking response:

```json
{
  "success": true,
  "data": {
    "item": {
      "id": "bk_123",
      "customerId": "usr_1",
      "createdByUserId": null,
      "serviceId": "svc_123",
      "branchId": "MAIN",
      "slotDate": "2026-02-23",
      "slotTime": "09:30",
      "appointmentAt": "2026-02-23T09:30:00.000Z",
      "status": "PENDING",
      "notes": "Customer asked for quick check",
      "rejectReason": null,
      "cancelReason": null,
      "cancelledByUserId": null,
      "finalPrice": null,
      "internalNote": null,
      "performedByEmployeeId": null,
      "serviceNameSnapshotEn": "Battery Diagnostic",
      "serviceNameSnapshotAr": "فحص البطارية",
      "serviceCategorySnapshot": "Electrical",
      "serviceBasePriceSnapshot": "40.00",
      "completedAt": null,
      "createdAt": "2026-02-22T12:00:00.000Z",
      "updatedAt": "2026-02-22T12:00:00.000Z"
    }
  }
}
```

### 3.3 Chat

Important: backend chat is **support-thread based**, not booking-scoped.

| Method | Path | Query | Body | Auth/Roles |
|---|---|---|---|---|
| GET | `/api/chat/threads` | none | none | Any logged-in user |
| POST | `/api/chat/threads` | none | `participantUserIds` (exactly one), `subject?` | Any logged-in user |
| GET | `/api/chat/messages` | `threadId, take?, cursor?` | none | Thread participants |
| POST | `/api/chat/messages` | none | `threadId, body` | Thread participants |
| PATCH | `/api/chat/messages` | none | `messageIds[]` | Thread participants |
| GET | `/api/chat/users` | `q?,take?` | none | Any logged-in user |
| GET | `/api/chat/unread-count` | none | none | Any logged-in user |
| GET | `/api/chat/customer-profile` | `threadId` | none | `ADMIN` only |

Example messages response:

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg_1",
        "threadId": "th_1",
        "senderId": "usr_admin",
        "body": "Your booking is confirmed",
        "createdAt": "2026-02-22T10:00:00.000Z",
        "sender": {
          "id": "usr_admin",
          "fullName": "Admin",
          "phone": "+9627...",
          "role": "ADMIN"
        },
        "seenBy": []
      }
    ],
    "nextCursor": null
  }
}
```

### 3.4 Reviews

| Method | Path | Query | Body | Auth/Roles |
|---|---|---|---|---|
| GET | `/api/reviews` | none | none | `CUSTOMER`,`RECEPTION`,`MANAGER`,`ADMIN` |
| POST | `/api/reviews` | none | `bookingId,rating,comment?` | `CUSTOMER` |
| POST | `/api/reviews/:id/moderate` | none | `status: APPROVED|REJECTED, reason?` | `MANAGER`,`ADMIN` |

### 3.5 Employees

| Method | Path | Query | Body | Auth/Roles |
|---|---|---|---|---|
| GET | `/api/employees` | none | none | `MANAGER`,`ADMIN` |
| POST | `/api/employees` | none | `phone,password,fullName,jobTitle?,monthlyBase?` | `MANAGER`,`ADMIN` |
| GET | `/api/employees/salaries` | none | none | `ACCOUNTANT`,`MANAGER`,`ADMIN` |
| POST | `/api/employees/salaries` | none | `employeeId,amount,periodMonth,periodYear,markPaid?,note?,occurredAt?` | `ACCOUNTANT`,`MANAGER`,`ADMIN` |

### 3.6 Attendance

| Method | Path | Query | Body | Auth/Roles |
|---|---|---|---|---|
| GET | `/api/employees/attendance` | `employeeId?` | none | `RECEPTION`,`MANAGER`,`ADMIN` |
| GET | `/api/employees/attendance/qr` | `employeeId` | none | `EMPLOYEE`,`RECEPTION`,`MANAGER`,`ADMIN` |
| POST | `/api/employees/attendance/checkin` | none | `employeeId,qrPayload,latitude?,longitude?,geoNote?` | `EMPLOYEE`,`RECEPTION`,`MANAGER`,`ADMIN` |

Example check-in response:

```json
{
  "success": true,
  "data": {
    "item": {
      "id": "att_1",
      "employeeId": "emp_1",
      "checkInAt": "2026-02-22T08:00:00.000Z",
      "checkOutAt": null,
      "qrPayload": "emp_1:1708598400000:signature",
      "note": null
    },
    "mode": "CHECK_IN"
  }
}
```

### 3.7 Accounting / Transactions

| Method | Path | Query | Body | Auth/Roles |
|---|---|---|---|---|
| GET | `/api/accounting/transactions` | none | none | `ACCOUNTANT`,`MANAGER`,`ADMIN` |
| GET | `/api/accounting/expenses` | none | none | `ACCOUNTANT`,`MANAGER`,`ADMIN` |
| POST | `/api/accounting/expenses` | none | `itemName,unitPrice,quantity,expenseCategory,partId?,supplierId?,supplierName?,invoiceId?,occurredAt,note?` | `ACCOUNTANT`,`MANAGER`,`ADMIN` |
| GET | `/api/accounting/reports/summary` | `from?,to?` | none | `ACCOUNTANT`,`MANAGER`,`ADMIN` |

### 3.8 Walk-in Income Creation

| Method | Path | Query | Body | Auth/Roles |
|---|---|---|---|---|
| POST | `/api/accounting/walkin-income` | none | `itemName,unitPrice,quantity,occurredAt,note?,branchId?` | `RECEPTION`,`MANAGER`,`ADMIN` |

### 3.9 Membership Plans / Subscriptions / Orders

| Method | Path | Query | Body | Auth/Roles |
|---|---|---|---|---|
| GET | `/api/memberships/plans` | none | none | Public |
| POST | `/api/memberships/plans` | none | `tier,nameEn,nameAr,descriptionEn?,descriptionAr?,price,durationDays` | `MANAGER`,`ADMIN` |
| GET | `/api/memberships/orders` | none | none | `CUSTOMER`,`RECEPTION`,`MANAGER`,`ADMIN` (customer sees own) |
| POST | `/api/memberships/orders` | none | `planId,customerId?,startDate?` | `CUSTOMER`,`RECEPTION`,`MANAGER`,`ADMIN` |
| POST | `/api/memberships/orders/:id/use-entitlement` | none | `serviceId,bookingId?,note?` | `CUSTOMER`,`RECEPTION`,`MANAGER`,`ADMIN` |

Current backend note:
- There is **no dedicated `/api/memberships/subscriptions` endpoint**.
- Operational subscription state is represented by `MembershipOrder` (`ACTIVE|EXPIRED|SUSPENDED`).

### 3.10 Admin Analytics Overview

| Method | Path | Query | Body | Auth/Roles |
|---|---|---|---|---|
| GET | `/api/admin/analytics/overview` | `from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=day|week|month` | none | `ADMIN` |

Validation rules:
- `from` and `to` required.
- `from <= to`.
- max span `366` days.

Example response (shape):

```json
{
  "success": true,
  "data": {
    "range": { "from": "2026-02-01", "to": "2026-02-22", "groupBy": "day" },
    "kpis": {
      "totalIncome": 12450.5,
      "totalExpenses": 7430.25,
      "totalProfit": 5020.25,
      "totalOrders": 133,
      "avgOrderValue": 89.3,
      "activeMemberships": 41,
      "newMembershipsInRange": 9
    },
    "timeseries": [
      {
        "bucketStart": "2026-02-01",
        "income": 550.0,
        "expenses": 230.0,
        "profit": 320.0,
        "orders": 6
      }
    ],
    "breakdowns": {
      "incomeBySource": [
        { "source": "BOOKING", "amount": 9110.5 },
        { "source": "WALK_IN", "amount": 2140.0 },
        { "source": "MEMBERSHIP", "amount": 1200.0 }
      ],
      "expensesByCategory": [
        { "category": "SUPPLIER", "amount": 4010.25 },
        { "category": "GENERAL", "amount": 1820.0 },
        { "category": "SALARY", "amount": 1600.0 }
      ],
      "ordersByStatus": [
        { "status": "COMPLETED", "count": 96 },
        { "status": "NO_SHOW", "count": 8 },
        { "status": "CANCELLED", "count": 5 }
      ]
    },
    "membership": {
      "newCount": 9,
      "renewedCount": 4,
      "expiredCount": 3,
      "membershipRevenue": 1200.0
    },
    "top": {
      "services": {
        "byRevenue": [
          {
            "serviceNameEn": "Battery Diagnostic",
            "serviceNameAr": "فحص البطارية",
            "ordersCount": 30,
            "revenue": 3150.0
          }
        ],
        "byOrders": [
          {
            "serviceNameEn": "Battery Diagnostic",
            "serviceNameAr": "فحص البطارية",
            "ordersCount": 30,
            "revenue": 3150.0
          }
        ]
      },
      "employees": [
        {
          "employeeId": "emp_1",
          "name": "Ahmad",
          "handledOrders": 38,
          "revenue": 4100.0,
          "workHours": 121.5,
          "ratingAvg": 4.6
        }
      ]
    },
    "recent": {
      "transactions": [
        {
          "id": "txn_1",
          "occurredAt": "2026-02-22T11:00:00.000Z",
          "type": "INCOME",
          "incomeSource": "BOOKING",
          "expenseCategory": null,
          "itemName": "Battery Diagnostic",
          "quantity": 1,
          "unitPrice": 95.0,
          "amount": 95.0,
          "recordedBy": "Admin"
        }
      ],
      "completedBookings": [
        {
          "id": "bk_1",
          "completedAt": "2026-02-22T10:40:00.000Z",
          "status": "COMPLETED",
          "customerName": "Mohammad",
          "serviceNameEn": "Battery Diagnostic",
          "serviceNameAr": "فحص البطارية",
          "employeeName": "Ahmad",
          "finalPrice": 95.0
        }
      ]
    }
  }
}
```

### 3.11 Admin Analytics AI Summary

| Method | Path | Query | Body | Auth/Roles |
|---|---|---|---|---|
| GET | `/api/admin/analytics/ai-summary` | `from=YYYY-MM-DD&to=YYYY-MM-DD` | none | `ADMIN` |

Response shape:
- `summaryText: string`
- `signals: [{ type, severity, title, detail }]`
- `compactData: { range, kpis, membership, incomeBySource, expensesByCategory, ordersByStatus, topServices, topEmployees, recentTrend }`

### 3.12 CSV Export Endpoints

| Method | Path | Query | Body | Auth/Roles | Response |
|---|---|---|---|---|---|
| GET | `/api/admin/reports/export-transactions` | `from,to` | none | `ADMIN` | `text/csv` attachment |
| GET | `/api/admin/reports/export-bookings` | `from,to` | none | `ADMIN` | `text/csv` attachment |

## 4) Data Models (Frontend TypeScript)

```ts
export type ISODateString = string;
export type DateOnlyString = string; // YYYY-MM-DD
export type DecimalString = string;

export type Role =
  | "CUSTOMER"
  | "EMPLOYEE"
  | "RECEPTION"
  | "ACCOUNTANT"
  | "MANAGER"
  | "ADMIN";

export type BookingStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "LATE_CANCELLED"
  | "NO_SHOW"
  | "COMPLETED"
  | "NOT_SERVED";

export type TransactionType = "INCOME" | "EXPENSE";

export type ExpenseCategory = "SUPPLIER" | "GENERAL" | "SALARY";

export type IncomeSource = "BOOKING" | "WALK_IN" | "MEMBERSHIP";

export type MembershipOrderStatus = "ACTIVE" | "EXPIRED" | "SUSPENDED";

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface User {
  id: string;
  phone: string;
  role: Role;
  fullName: string | null;
  locale?: string;
  isActive?: boolean;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
}

export interface Service {
  id: string;
  nameEn: string;
  nameAr: string;
  category: string | null;
  basePrice: DecimalString | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  durationMinutes: number;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface BookingServiceAssignment {
  id: string;
  bookingId: string;
  employeeId: string;
  serviceId: string | null;
  note: string | null;
  createdAt: ISODateString;
  employee?: Employee;
  service?: Service | null;
}

export interface Booking {
  id: string;
  customerId: string;
  createdByUserId: string | null;
  serviceId: string;
  branchId: string;
  slotDate: DateOnlyString;
  slotTime: string;
  appointmentAt: ISODateString;
  status: BookingStatus;
  notes: string | null;
  rejectReason: string | null;
  cancelReason: string | null;
  cancelledByUserId: string | null;
  finalPrice: DecimalString | null;
  internalNote: string | null;
  performedByEmployeeId: string | null;
  serviceNameSnapshotEn: string;
  serviceNameSnapshotAr: string;
  serviceCategorySnapshot: string | null;
  serviceBasePriceSnapshot: DecimalString | null;
  completedAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  service?: Service;
  customer?: Pick<User, "id" | "fullName" | "phone">;
  performedByEmployee?: Employee | null;
  assignments?: BookingServiceAssignment[];
}

export interface Transaction {
  id: string;
  type: TransactionType;
  itemName: string;
  unitPrice: number;
  quantity: number;
  amount: DecimalString;
  note: string | null;
  description: string | null;
  bookingId: string | null;
  expenseId: string | null;
  invoiceLineId: string | null;
  membershipOrderId: string | null;
  incomeSource: IncomeSource | null;
  expenseCategory: ExpenseCategory | null;
  referenceType: string | null;
  referenceId: string | null;
  occurredAt: ISODateString;
  recordedAt: ISODateString;
  createdById: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Employee {
  id: string;
  userId: string;
  jobTitle: string | null;
  monthlyBase: DecimalString | null;
  qrSecret: string;
  isActive: boolean;
  hiredAt: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  user?: User;
}

export interface AttendanceLog {
  id: string;
  employeeId: string;
  checkInAt: ISODateString;
  checkOutAt: ISODateString | null;
  qrPayload: string;
  note: string | null;
  employee?: Employee;
}

export type MembershipPlanTier = "BRONZE" | "SILVER" | "GOLD";

export interface MembershipPlanEntitlement {
  id: string;
  planId: string;
  serviceId: string;
  totalUses: number;
  preventDuplicatePerBooking: boolean;
  createdAt: ISODateString;
  service?: Service;
}

export interface MembershipPlan {
  id: string;
  tier: MembershipPlanTier;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  price: DecimalString;
  durationDays: number;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  entitlements?: MembershipPlanEntitlement[];
}

export interface MembershipUsage {
  id: string;
  orderId: string;
  serviceId: string;
  bookingId: string | null;
  usedAt: ISODateString;
  note: string | null;
  createdByUserId: string | null;
}

export interface MembershipOrder {
  id: string;
  customerId: string;
  planId: string;
  status: MembershipOrderStatus;
  priceSnapshot: DecimalString;
  startDate: ISODateString | null;
  endDate: ISODateString | null;
  paidAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  customer?: Pick<User, "id" | "fullName" | "phone" | "role">;
  plan?: MembershipPlan;
  usages?: MembershipUsage[];
  transactions?: Transaction[];
}

// Backend does not expose a separate MembershipSubscription resource currently.
// Use MembershipOrder as the subscription entity in frontend.
export type MembershipSubscription = MembershipOrder;

export interface AnalyticsOverviewData {
  range: {
    from: DateOnlyString;
    to: DateOnlyString;
    groupBy: "day" | "week" | "month";
  };
  kpis: {
    totalIncome: number;
    totalExpenses: number;
    totalProfit: number;
    totalOrders: number;
    avgOrderValue: number;
    activeMemberships: number;
    newMembershipsInRange: number;
  };
  timeseries: Array<{
    bucketStart: DateOnlyString;
    income: number;
    expenses: number;
    profit: number;
    orders: number;
  }>;
  breakdowns: {
    incomeBySource: Array<{ source: IncomeSource; amount: number }>;
    expensesByCategory: Array<{ category: ExpenseCategory; amount: number }>;
    ordersByStatus: Array<{ status: BookingStatus; count: number }>;
  };
  membership: {
    newCount: number;
    renewedCount: number;
    expiredCount: number;
    membershipRevenue: number;
  };
  top: {
    services: {
      byRevenue: Array<{
        serviceNameEn: string;
        serviceNameAr: string;
        ordersCount: number;
        revenue: number;
      }>;
      byOrders: Array<{
        serviceNameEn: string;
        serviceNameAr: string;
        ordersCount: number;
        revenue: number;
      }>;
    };
    employees: Array<{
      employeeId: string;
      name: string;
      handledOrders: number;
      revenue: number;
      workHours: number;
      ratingAvg: number | null;
    }>;
  };
  recent: {
    transactions: Array<{
      id: string;
      occurredAt: ISODateString;
      type: TransactionType;
      incomeSource: IncomeSource | null;
      expenseCategory: ExpenseCategory | null;
      itemName: string;
      quantity: number;
      unitPrice: number;
      amount: number;
      recordedBy: string;
    }>;
    completedBookings: Array<{
      id: string;
      completedAt: ISODateString;
      status: BookingStatus;
      customerName: string;
      serviceNameEn: string;
      serviceNameAr: string;
      employeeName: string;
      finalPrice: number;
    }>;
  };
}

export type AnalyticsOverviewResponse = ApiSuccess<AnalyticsOverviewData>;

export interface AISummaryData {
  summaryText: string;
  signals: Array<{
    type: "growth" | "risk" | "anomaly" | "opportunity";
    severity: "low" | "medium" | "high";
    title: string;
    detail: string;
  }>;
  compactData: {
    range: AnalyticsOverviewData["range"];
    kpis: AnalyticsOverviewData["kpis"];
    membership: AnalyticsOverviewData["membership"];
    incomeBySource: AnalyticsOverviewData["breakdowns"]["incomeBySource"];
    expensesByCategory: AnalyticsOverviewData["breakdowns"]["expensesByCategory"];
    ordersByStatus: AnalyticsOverviewData["breakdowns"]["ordersByStatus"];
    topServices: AnalyticsOverviewData["top"]["services"]["byRevenue"];
    topEmployees: AnalyticsOverviewData["top"]["employees"];
    recentTrend: AnalyticsOverviewData["timeseries"];
  };
}

export type AISummaryResponse = ApiSuccess<AISummaryData>;
```

## 5) Business Rules (Important)

### Booking completion -> income recording
- Booking completion is performed through: `POST /api/admin/bookings/:id/complete`.
- On completion, backend updates booking status to `COMPLETED`, sets `finalPrice`, `completedAt`, optional `performedByEmployeeId`.
- In the same DB transaction, backend creates one ledger transaction:
  - `type = INCOME`
  - `incomeSource = BOOKING`
  - `bookingId = <bookingId>`
  - `amount = finalPrice`

### Idempotency rules
- `Transaction.bookingId` is unique.
- If booking is already completed and has a transaction, endpoint returns existing booking safely.
- Unique constraint conflict (`P2002`) is handled and existing booking+transaction is returned.

### Date field usage in analytics
For `/api/admin/analytics/overview`:
- Income/expenses: `Transaction.occurredAt`.
- Total orders + orders timeseries + orders by status: `Booking.appointmentAt`.
- Avg order value/top services/top employees/recent completed bookings: completed bookings filtered by `Booking.completedAt`.
- Membership revenue: income transactions where `incomeSource = MEMBERSHIP`, by `occurredAt`.
- Membership new/renewed: based on `MembershipOrder.createdAt`.
- Membership expired: by `MembershipOrder.endDate` in range.

### Profit source of truth
- `profit = sum(INCOME transactions) - sum(EXPENSE transactions)` within range.

### Employee performance computation
- Handled orders/revenue: completed bookings grouped by `performedByEmployeeId`.
- Work hours: attendance logs (`checkInAt`/`checkOutAt`) in range.
- Rating average: reviews linked to completed bookings performed by employee.

### Membership metrics rules
- New memberships: first membership order for that customer (historically) within selected range.
- Renewed memberships: additional orders by customers with prior or same-range previous orders.
- Expired memberships: orders with `endDate` in selected range.
- Membership revenue: transaction ledger (`INCOME` + `MEMBERSHIP`).

## 6) UI Requirements Snapshot (for frontend dev)

- Must support Arabic RTL and English LTR.
- Must support dark/light themes using CSS variables (blue palette requested).
- Mobile-first responsive behavior.
- Single admin analytics page with global date range filter controlling all widgets.

## 7) Sample cURL Requests (3)

### 7.1 Auth session flow (login then me)

```bash
curl -i -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -c cookie.txt \
  -d '{"phone":"+962790000001","password":"Secret123!"}'

curl -i "http://localhost:3000/api/auth/me" \
  -b cookie.txt
```

### 7.2 Admin analytics overview

```bash
curl -G "http://localhost:3000/api/admin/analytics/overview" \
  -b cookie.txt \
  --data-urlencode "from=2026-02-01" \
  --data-urlencode "to=2026-02-22" \
  --data-urlencode "groupBy=day"
```

### 7.3 Create booking

```bash
curl -X POST "http://localhost:3000/api/bookings" \
  -H "Content-Type: application/json" \
  -b cookie.txt \
  -d '{
    "serviceId": "svc_123",
    "appointmentAt": "2026-02-23T09:30:00.000Z",
    "notes": "Customer asked for quick check",
    "branchId": "MAIN"
  }'
```

## 8) Sample JSON Payloads (3)

### 8.1 Booking creation request payload

```json
{
  "serviceId": "svc_123",
  "appointmentAt": "2026-02-23T09:30:00.000Z",
  "notes": "Customer asked for quick check",
  "branchId": "MAIN"
}
```

### 8.2 Booking creation success payload

```json
{
  "success": true,
  "data": {
    "item": {
      "id": "bk_123",
      "customerId": "usr_1",
      "createdByUserId": null,
      "serviceId": "svc_123",
      "branchId": "MAIN",
      "slotDate": "2026-02-23",
      "slotTime": "09:30",
      "appointmentAt": "2026-02-23T09:30:00.000Z",
      "status": "PENDING",
      "notes": "Customer asked for quick check",
      "finalPrice": null,
      "completedAt": null,
      "createdAt": "2026-02-22T12:00:00.000Z",
      "updatedAt": "2026-02-22T12:00:00.000Z"
    }
  }
}
```

### 8.3 Analytics overview success payload

```json
{
  "success": true,
  "data": {
    "range": { "from": "2026-02-01", "to": "2026-02-22", "groupBy": "week" },
    "kpis": {
      "totalIncome": 12450.5,
      "totalExpenses": 7430.25,
      "totalProfit": 5020.25,
      "totalOrders": 133,
      "avgOrderValue": 89.3,
      "activeMemberships": 41,
      "newMembershipsInRange": 9
    },
    "timeseries": [
      {
        "bucketStart": "2026-01-26",
        "income": 2850,
        "expenses": 1550,
        "profit": 1300,
        "orders": 31
      }
    ],
    "breakdowns": {
      "incomeBySource": [
        { "source": "BOOKING", "amount": 9110.5 },
        { "source": "WALK_IN", "amount": 2140 },
        { "source": "MEMBERSHIP", "amount": 1200 }
      ],
      "expensesByCategory": [
        { "category": "SUPPLIER", "amount": 4010.25 },
        { "category": "GENERAL", "amount": 1820 },
        { "category": "SALARY", "amount": 1600 }
      ],
      "ordersByStatus": [
        { "status": "COMPLETED", "count": 96 },
        { "status": "NO_SHOW", "count": 8 }
      ]
    },
    "membership": {
      "newCount": 9,
      "renewedCount": 4,
      "expiredCount": 3,
      "membershipRevenue": 1200
    },
    "top": { "services": { "byRevenue": [], "byOrders": [] }, "employees": [] },
    "recent": { "transactions": [], "completedBookings": [] }
  }
}
```

## 9) MISSING INFO / REQUIRED CHANGES

1. **Cross-origin SPA support is missing by default**.
   - No explicit CORS handling in backend routes.
   - If Antigravity SPA is on a different domain/port, backend must add CORS headers and allow credentials.

2. **No dedicated membership subscription API**.
   - Backend uses `MembershipOrder` as subscription entity.
   - If frontend architecture expects `/memberships/subscriptions`, add compatibility endpoint or map to orders.

3. **Chat is not booking-scoped**.
   - Existing chat uses support threads (`/api/chat/*`), not `/api/bookings/:id/chat`.
   - If booking-chat UX is required, backend contract changes are needed.

4. **Analytics access is ADMIN-only**.
   - `/api/admin/analytics/*` and export endpoints currently reject non-admin roles.
   - If manager/accountant access is needed, role guard changes are required.

5. **`createMembershipOrder` schema exposes `customerId` and `startDate`, but route currently ignores them**.
   - Route creates order for `actor.sub` and `startDate=now`.
   - Frontend should not rely on those fields until backend behavior is aligned.

6. **Inconsistent list pagination strategy**.
   - Most list endpoints use fixed `take` limits with no page/cursor metadata.
   - If frontend needs large data browsing, backend should add standardized pagination.
