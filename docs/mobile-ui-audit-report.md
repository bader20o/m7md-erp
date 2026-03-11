# Mobile UI Audit Report

Date: March 4, 2026

## Route Notes

- `/admin/dashboard` is represented by `/[locale]/admin/analytics` and `/[locale]/admin/reports/analytics`.
- `/admin/employees` and `/admin/customers` do not exist in the current `app/` tree; the closest live management surface is `/[locale]/admin/users`.
- `/admin/settings` does not exist as a single route; related settings live under `/[locale]/admin/about-settings` and `/[locale]/admin/working-hours`.
- `/employee/home` does not exist; the employee-facing pages in `app/` are `/[locale]/employee/qr-scan`, `/[locale]/tasks`, `/[locale]/profile`, and `/[locale]/chat`.
- `/book` maps to `/[locale]/bookings/new`.
- `/signup` maps to `/[locale]/register`.

## Audit Checklist

| Issue Title | Page / Component | Steps To Reproduce | Root Cause | Fix Approach | Status |
| --- | --- | --- | --- | --- | --- |
| Global horizontal overflow risk | `app/globals.css`, shared app shell | Open any page at 360px width and inspect edges while scrolling | Desktop-first spacing, media elements, and body width allowed overflow inheritance | Added global `overflow-x: hidden`, safer media sizing, smaller mobile type scale, and 44px minimum control height for form controls | Pass |
| Small nav tap targets | `components/layout/AppShell.tsx` | Open mobile nav header and try opening/closing drawer | Icon buttons rendered below 44px hit target | Updated drawer open/close controls to explicit `h-11 w-11` buttons | Pass |
| Tables forcing sideways scroll | `components/ui/responsive-data-table.tsx` | Open dense list pages at 360px width | Legacy tables relied on `overflow-x-auto` instead of mobile row layouts | Added shared responsive table/card renderer and switched affected pages to mobile cards with no horizontal scroll | Pass |
| Admin users list overflow | `/[locale]/admin/users`, `components/admin/user-role-manager.tsx` | Open users page on phone width | Seven-column table had no mobile alternate layout | Desktop table remains on `md+`; mobile now renders stacked cards with inline role editor and full-width save action | Pass |
| Audit log overflow | `/[locale]/admin/audit-logs` | Open audit log page on phone width | Five-column table forced horizontal panning | Replaced with shared responsive table/cards | Pass |
| Accounting ledger overflow | `/[locale]/admin/transactions` | Open transactions page on phone width | Ledger table and export action were desktop-sized | Converted ledger to mobile cards and enlarged export action | Pass |
| Accounting cart table overflow | `components/admin/accounting-entry-forms.tsx` | Add sale cart rows on mobile | Inline cart table overflowed and actions were cramped | Converted cart table to cards on mobile; added sticky checkout summary bar | Pass |
| Accounting modal vertical overflow | `components/admin/accounting-entry-forms.tsx` | Open “Add To Cart” modal on short viewport | Modal used full-content height with no fixed header/footer | Added `max-h-[85vh]`, internal scroll, sticky footer actions, and visible close control | Pass |
| Membership plan modal overflow | `components/admin/membership-plan-manager.tsx` | Open create/edit plan modal on mobile | Large editor used full-page scroll inside modal body and non-sticky actions | Added constrained modal shell, internal scrolling, sticky header, and sticky footer actions | Pass |
| Membership cards too dense on mobile | `/[locale]/admin/memberships`, `/[locale]/memberships` | Open plan grids on phone width | Grid started at multi-column layouts too early | Kept one column on mobile, two on tablet, three on desktop | Pass |
| Employee QR history table overflow | `/[locale]/employee/qr-scan`, `components/attendance/employee-qr-scan-page.tsx` | Open recent scans on phone width | Table required horizontal room; scanner area could feel cramped | Converted scan history to cards on mobile and strengthened camera area sizing | Pass |
| Booking service filters wrapping badly | `/[locale]/bookings/new`, `components/bookings/create-booking-form.tsx` | Open service step on phone width | Filter tabs were inline-flex and compressed | Switched filters to stacked grid on mobile and preserved horizontal tab layout on larger screens | Pass |
| Booking proceed CTA hard to reach | `/[locale]/bookings/new` | Scroll long service list on phone width | Submit action sat at page bottom with no sticky affordance | Added sticky mobile action bar and preserved desktop behavior | Pass |
| Login/register card fit and touch targets | `/[locale]/login`, `/[locale]/register`, auth forms | Open forms on 360px width | Tight spacing and smaller controls reduced touch comfort | Increased shell fit, input/button heights, and full-width primary actions | Pass |
| Chart tooltip clipping / chart min-width pressure | Admin analytics chart frames | Hover charts in narrow cards | Recharts containers used fixed minimum widths; tooltips needed escape context | Existing tooltip z-index rules preserved; chart frames already use `overflow-visible`, and min-width pressure was kept within responsive card widths | Pass (code review) |
| Dense filters above history | Inventory movement filters | Open movement history filters on phone width | Three filters rendered inline above history | Kept filters stacked vertically on mobile and removed horizontal pressure from the history section by switching the history rows to cards | Pass |

## QA Checklist

| Check | Result |
| --- | --- |
| No horizontal scroll on updated shared/table-driven pages at 360px width | Pass |
| Mobile rows render as cards with visible primary and secondary fields | Pass |
| Updated modals fit within viewport and scroll internally | Pass |
| Touch targets for updated primary actions and inputs meet 44px minimum | Pass |
| RTL-safe text wrapping preserved through shared card renderer and existing locale-aware layouts | Pass (code review) |
| TypeScript validation after changes | Pass (`npm run typecheck`) |

## Remaining Gaps

- The repo does not currently expose separate `/admin/employees`, `/admin/customers`, `/admin/settings`, `/employee/home`, or `/signup` routes, so those exact URLs were marked against their live equivalents.
- This pass was validated by code audit plus TypeScript verification. Browser-driven screenshot regression and authenticated Playwright checks were not run in this task.
