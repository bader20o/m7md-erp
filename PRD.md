# PRD.md  
# Hybrid & Electric Car Service Center Platform

---

## 1. Project Overview

Project Name:  
Hybrid & Electric Car Service Center Platform

Description:  
A Web Application + Mobile-ready Platform for managing a Hybrid & Electric Car Service Center.  
The system acts as a mini ERP including:

- Booking System  
- Internal Accounting System  
- Employee Management  
- Membership Cards  
- Reports & Analytics  
- Role-Based Access  
- Notifications  
- Backup System  

Goal:  
Digitize all center operations into a single integrated platform.

---

## 2. User Roles

### 2.1 Customer

Permissions:
- Register / Login using phone number
- Book service appointment
- Cancel booking with reason (subject to cancellation policy)
- View booking history
- Submit reviews with images after service completion
- Request membership cards
- Edit profile
- Chat with admin
- View services, offers, opening hours, About Us

Restricted:
- Accounting
- Employees
- Reports

---

### 2.2 Employee

Permissions:
- QR check-in / check-out
- View work schedule
- View own profile
- View public content (services, offers, hours)

Restricted:
- Accounting
- Reports
- Service management
- Booking management

---

### 2.3 Admin Roles

#### Admin (Full Access)

Complete system control.

#### Manager

- Manage bookings  
- Manage services  
- Manage customers  

#### Accountant

- Accounting  
- Expenses  
- Financial reports  

#### Reception

- Walk-in customer entry  
- Direct booking creation  

---

## 3. Booking System

### Booking Statuses:

- Pending Approval  
- Approved  
- Waiting Attendance  
- Completed  
- Rejected  
- Cancelled By Customer  
- Late Cancellation  
- No Show  
- Not Served  

---

### Booking Creation:

Customer provides:

- Service  
- Car Brand  
- Car Model  
- Car Type  
- Date  
- Time  
- Notes  

---

### Cancellation Policy:

- Cancellation allowed before X hours
- Cancellation requires reason
- Cancellation count stored per user

Statuses:
- Cancelled By Customer  
- Late Cancellation  

Admin Reports:
- Most common cancellation reasons  
- Most cancelling users  

---

## 4. Reviews System

- Customer submits rating + optional image
- Default status: Pending Moderation
- Admin approves or rejects

---

## 5. Membership Cards

Types:
- Bronze  
- Silver  
- Gold  

Membership Request Fields:
- Car Brand  
- Car Type  
- Car Model  
- Chassis Number  
- Owner Name  
- Card Type  

Admin Panel:
- Alphabetical list
- Search
- Service consumption checkboxes
- Prevent duplicate benefit usage

---

## 6. Accounting System

### Income Sources:
- App bookings
- Walk-in customers
- Membership cards

### Expenses:
- Supplier
- Item
- Quantity
- Price
- Date
- Notes

Supports:
- Multiple purchases grouped into single invoice

---

### Net Profit:

Net Profit = Total Income - Total Expenses

---

## 7. Dashboard

Filter by:
- Day
- Week
- Month
- Custom Range

Displays:
- Income
- Expenses
- Net Profit
- Booking count
- No Shows
- Top services
- Top employees by productivity

Chart:

X = Time  
Y = Amount  

Separated:
- Application Income
- Walk-in Income

---

## 8. Employee Management

- QR attendance
- Employee-service linking
- Productivity reports
- Salary system
- Paid / Remaining balances
- Summary displayed on dashboard

---

## 9. Notification System

Customer:
- Booking approved/rejected
- Appointment reminders
- Service completion

Admin:
- New booking
- New review
- Membership requests

---

## 10. About Us Page

Contains:
- Center description
- Google Maps location
- Phone (click-to-call)
- WhatsApp link
- Social media URLs
- Working hours

Editable by Admin.

---

## 11. Role Permission System

Roles:
- Admin
- Manager
- Accountant
- Reception
- Employee

Each role has independent permissions.

---

## 12. Activity Logs

Records:
- User
- Action
- Timestamp

Examples:
- Price changes
- Booking decisions
- Expense entries

---

## 13. Backup System

- Automatic daily backups
- Keep last 30 backups
- Manual export
- One-click restore

---

## 14. Inventory (Phase 2 Optional)

- Material quantities
- Low stock alerts
- Service-material linkage

---

## 15. Security

- JWT Authentication
- Role-based access
- Booking slot locking
- QR GPS validation
- Full system logs

---

## 16. Expected Scenarios

- Prevent double booking
- Preserve service price at booking time
- Abuse prevention for cancellations
- Walk-in support
- PDF invoice generation
- Multi-branch readiness

---

## 17. Development Phases

### Phase 1:
- Authentication
- Booking
- Services
- Basic Accounting
- Dashboard

### Phase 2:
- Membership
- Employees
- QR
- Advanced Reports
- Inventory

---

End of BRD
# Product Requirements

## Product
Hybrid & Electric Car Service Center Platform (web app, mobile-ready).

## Core Roles
- CUSTOMER
- EMPLOYEE
- RECEPTION
- ACCOUNTANT
- MANAGER
- ADMIN

## Core Features
- Phone/password authentication
- Role-based access control (RBAC)
- Booking lifecycle:
  - create booking with slot locking
  - cancel booking with policy + reason
  - mark late cancellation
  - complete booking and auto-create accounting income transaction
- Service price snapshot persisted at booking creation
- Accounting:
  - app booking income
  - walk-in income
  - membership income
  - expense ledger with supplier and invoice grouping
- Membership plans, orders, and entitlement usage tracking
- Employee management, QR attendance, salary payments
- Employee-to-booking service assignment for completed jobs
- Review submission and moderation
- Public About Us and working hours
- Notifications and seen/unseen state
- Internal chat via DB messages + polling
- Audit logs for sensitive actions
- Backup system:
  - manual trigger
  - daily scheduled job option
  - retention pruning

## Admin Navigation Groups
- Customers: Bookings, Reviews, Membership Orders, Users
- Employees: Attendance, Salaries
- Center: Services, Offers/Slider, About/Settings, Working Hours
- Accounting: Transactions, Invoices, Suppliers, Reports
- System: Audit Logs, Backups

## Localization
- Arabic + English
- RTL/LTR switching by locale route
