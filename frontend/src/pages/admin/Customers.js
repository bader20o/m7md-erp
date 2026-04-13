import { apiFetch, buildQuery } from "../../lib/api.js";
import { DateInput } from "../../components/ui/DateInput.js";
import { TableRowSkeleton } from "../../components/ui/Skeleton.js";
import { AlertModal } from "../../components/ui/Modal.js";

const LOCAL_PHONE_REGEX = /^07\d{8}$/;

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function formatMoney(value) {
  const number = Number(value || 0);
  return `${number.toFixed(2)} JOD`;
}

function normalizeVehicleFuelType(value) {
  const key = String(value || "").toLowerCase();
  if (key.includes("hybrid")) return "Hybrid";
  if (key.includes("ev") || key.includes("electric")) return "EV";
  if (key.includes("fuel") || key.includes("gas") || key.includes("diesel") || key.includes("petrol")) return "Fuel";
  return value || "Unknown";
}

function activityIcon(type) {
  if (type === "booking") {
    return `<svg class="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8 2v3M16 2v3M3.5 9.5h17M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg>`;
  }
  if (type === "service") {
    return `<svg class="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M14.8 6.2a4.2 4.2 0 0 0 3 7.2l-7.9 7.9a2 2 0 1 1-2.8-2.8l7.9-7.9a4.2 4.2 0 0 1-5.4-5.4l2.4 2.4 2.1-2.1-2.3-2.3z"/></svg>`;
  }
  if (type === "payment") {
    return `<svg class="w-4 h-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7h18v10H3z"/><path stroke-linecap="round" stroke-linejoin="round" d="M7 12h4M17 10v4"/></svg>`;
  }
  if (type === "cancelled") {
    return `<svg class="w-4 h-4 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 9l6 6M15 9l-6 6"/><circle cx="12" cy="12" r="9"/></svg>`;
  }
  return `<svg class="w-4 h-4 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18.2A2 2 0 0 0 3.6 21h16.8a2 2 0 0 0 1.8-2.8L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>`;
}

function statusBadge(status) {
  if (status === "banned") return `<span class="px-2.5 py-1 bg-danger/15 text-danger rounded-md text-[10px] font-bold uppercase tracking-wider">BANNED</span>`;
  if (status === "suspended") return `<span class="px-2.5 py-1 bg-amber-500/15 text-amber-500 rounded-md text-[10px] font-bold uppercase tracking-wider">SUSPENDED</span>`;
  return `<span class="px-2.5 py-1 bg-success/15 text-success rounded-md text-[10px] font-bold uppercase tracking-wider">ACTIVE</span>`;
}

function bookingStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  if (["completed", "done", "finished", "served"].includes(key)) {
    return `<span class="px-2.5 py-1 bg-success/15 text-success rounded-md text-[10px] font-bold uppercase tracking-wider">Completed</span>`;
  }
  if (["cancelled", "canceled", "rejected", "no_show", "no-show", "not_served", "not-served"].includes(key)) {
    return `<span class="px-2.5 py-1 bg-danger/15 text-danger rounded-md text-[10px] font-bold uppercase tracking-wider">${key.replace(/_/g, " ")}</span>`;
  }
  if (["pending", "requested", "draft", "scheduled", "approved", "accepted", "in_progress", "in-progress"].includes(key)) {
    return `<span class="px-2.5 py-1 bg-primary/15 text-primary rounded-md text-[10px] font-bold uppercase tracking-wider">${key.replace(/_/g, " ")}</span>`;
  }
  return `<span class="px-2.5 py-1 bg-bg text-muted rounded-md text-[10px] font-bold uppercase tracking-wider border border-border">${key || "-"}</span>`;
}

function avatarFor(fullName, avatarUrl) {
  if (avatarUrl) {
    return `<img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover border border-border" alt="avatar">`;
  }
  return `<div class="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center border border-border">${(fullName || "C").charAt(0).toUpperCase()}</div>`;
}

export function AdminCustomers() {
  window.onMount = () => {
    const tbody = document.getElementById("customers-tbody");
    const pagination = document.getElementById("customers-pagination");
    const queryInput = document.getElementById("customers-search");
    const statusFilter = document.getElementById("customers-status");
    const joinFromFilter = document.getElementById("customers-join-from");
    const joinToFilter = document.getElementById("customers-join-to");
    const createForm = document.getElementById("customer-create-form");
    const createToggle = document.getElementById("toggle-customer-create");
    const createContainer = document.getElementById("customer-create-container");
    const customerPhoneInput = document.getElementById("customer-create-phone");
    const duplicateWarning = document.getElementById("customer-duplicate-warning");
    const phoneError = document.getElementById("customer-phone-error");
    const createSubmitBtn = document.getElementById("customer-create-submit");
    const createFullNameInput = document.getElementById("customer-create-full-name");

    const state = {
      q: "",
      status: "",
      joinFrom: "",
      joinTo: "",
      page: 1,
      limit: 10,
      total: 0,
      loading: false,
      duplicateBlocked: false,
      phoneInvalid: false
    };

    let searchDebounce = null;
    let duplicateDebounce = null;

    function validateCreatePhone() {
      const phone = customerPhoneInput.value.trim();
      if (!phone) {
        phoneError.classList.add("hidden");
        phoneError.textContent = "";
        state.phoneInvalid = false;
        return true;
      }
      if (!/^07\d{8}$/.test(phone)) {
        phoneError.classList.remove("hidden");
        phoneError.textContent = "Phone must start with 07 and contain exactly 10 digits.";
        state.phoneInvalid = true;
        return false;
      }
      phoneError.classList.add("hidden");
      phoneError.textContent = "";
      state.phoneInvalid = false;
      return true;
    }

    async function checkCustomerPhoneDuplicate() {
      const phone = customerPhoneInput.value.trim();
      if (!phone) {
        duplicateWarning.classList.add("hidden");
        duplicateWarning.textContent = "";
        state.duplicateBlocked = false;
        return;
      }
      try {
        const query = buildQuery({ phone });
        const result = await apiFetch(`/admin/users/check-duplicate${query}`);
        if (result.phone?.exists) {
          duplicateWarning.classList.remove("hidden");
          duplicateWarning.textContent = `Phone already exists (${result.phone.profile.fullName || result.phone.profile.phone}).`;
          state.duplicateBlocked = true;
        } else {
          duplicateWarning.classList.add("hidden");
          duplicateWarning.textContent = "";
          state.duplicateBlocked = false;
        }
      } catch {
        duplicateWarning.classList.add("hidden");
        duplicateWarning.textContent = "";
        state.duplicateBlocked = false;
      }
    }

    function renderPagination() {
      const pages = Math.max(1, Math.ceil(state.total / state.limit));
      pagination.innerHTML = `
        <div class="text-xs text-muted">Page ${state.page} of ${pages} (${state.total} customers)</div>
        <div class="flex items-center gap-2">
          <button id="customers-prev-page" class="px-3 py-1.5 rounded-lg border border-border text-sm ${state.page <= 1 ? "opacity-50 cursor-not-allowed" : "hover:border-primary"}">Prev</button>
          <button id="customers-next-page" class="px-3 py-1.5 rounded-lg border border-border text-sm ${state.page >= pages ? "opacity-50 cursor-not-allowed" : "hover:border-primary"}">Next</button>
        </div>
      `;

      document.getElementById("customers-prev-page").addEventListener("click", () => {
        if (state.page <= 1) return;
        state.page -= 1;
        loadCustomers();
      });

      document.getElementById("customers-next-page").addEventListener("click", () => {
        if (state.page >= pages) return;
        state.page += 1;
        loadCustomers();
      });
    }

    async function loadCustomers() {
      if (state.loading) return;
      state.loading = true;
      tbody.innerHTML = TableRowSkeleton(10).repeat(5);

      try {
        const query = buildQuery({
          q: state.q,
          status: state.status,
          joinFrom: state.joinFrom,
          joinTo: state.joinTo,
          page: state.page,
          limit: state.limit
        });
        const response = await apiFetch(`/admin/customers${query}`);
        state.total = response.total || 0;
        const items = response.items || [];

        if (!items.length) {
          tbody.innerHTML = `<tr><td colspan="10" class="py-12 text-center text-muted text-sm">No customers found.</td></tr>`;
        } else {
          tbody.innerHTML = items
            .map(
              (item) => {
                const balanceDue = Number(item.balanceDue || 0);
                const debtStateClass =
                  balanceDue > 0
                    ? "bg-danger/10 text-danger border-danger/20"
                    : balanceDue < 0
                      ? "bg-success/10 text-success border-success/20"
                      : "bg-bg text-muted border-border";
                const debtStateLabel = balanceDue > 0 ? "Debt" : balanceDue < 0 ? "Credit" : "Settled";
                return `
            <tr class="border-b border-border hover:bg-bg cursor-pointer transition-colors" onclick="window.openCustomerDetails('${item.id}')">
              <td class="px-5 py-3.5">
                <div class="flex items-center gap-3">
                  ${avatarFor(item.fullName, item.avatar)}
                  <div>
                    <div class="text-sm font-semibold text-text">${item.fullName || "Unnamed Customer"}</div>
                    <div class="text-xs text-muted">${item.phone}</div>
                  </div>
                </div>
              </td>
              <td class="px-5 py-3.5 text-sm">${item.phone}</td>
              <td class="px-5 py-3.5 text-sm whitespace-nowrap">${formatDate(item.joinedAt)}</td>
              <td class="px-5 py-3.5">${statusBadge(item.status)}</td>
              <td class="px-5 py-3.5 text-sm font-semibold text-text whitespace-nowrap">${formatMoney(item.totalPaid)}</td>
              <td class="px-5 py-3.5 text-sm font-semibold text-text whitespace-nowrap">${formatMoney(item.totalServicesCost)}</td>
              <td class="px-5 py-3.5 text-sm text-center whitespace-nowrap">
                <span class="inline-flex min-w-[5.25rem] items-center justify-center rounded-md bg-bg px-2.5 py-1 text-[11px] font-semibold tabular-nums whitespace-nowrap border border-border text-text">
                  ${item.completedJobs} / ${item.totalBookings}
                </span>
              </td>
              <td class="px-5 py-3.5 text-sm whitespace-nowrap text-muted">${item.lastActivityDate ? formatDate(item.lastActivityDate) : "No activity"}</td>
              <td class="px-5 py-3.5 text-sm whitespace-nowrap">
                <span class="inline-flex items-center gap-2 rounded-md border px-2.5 py-1 font-semibold ${debtStateClass}">
                  <span class="text-[10px] uppercase tracking-wider">${debtStateLabel}</span>
                  <span class="tabular-nums">${formatMoney(item.balanceDue)}</span>
                </span>
              </td>
              <td class="px-5 py-3.5 text-right">
                <span class="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">View</span>
              </td>
            </tr>
          `
              }
            )
            .join("");
        }
      } catch (error) {
        tbody.innerHTML = `<tr><td colspan="10" class="py-12 text-center text-danger text-sm">${error.message}</td></tr>`;
      } finally {
        state.loading = false;
        renderPagination();
      }
    }

    async function loadCustomerDetails(id) {
      const drawer = document.getElementById("customer-details-drawer");
      const content = document.getElementById("customer-details-content");
      const title = document.getElementById("customer-drawer-title");
      drawer.classList.remove("hidden");
      drawer.classList.add("flex");
      content.innerHTML = `<div class="py-10 text-center text-muted">Loading...</div>`;

      try {
        const response = await apiFetch(`/admin/customers/${id}`);
        const customer = response.item;
        title.textContent = customer.fullName || "Customer";

        const ledgerRows = customer.customerLedgerEntries || [];
        const ledgerHtml =
          ledgerRows.length > 0
            ? ledgerRows
              .map(
                (entry) => `
              <tr class="border-b border-white/10 hover:bg-slate-800/40 transition-colors">
                <td class="px-3 py-2 text-xs">${entry.type}</td>
                <td class="px-3 py-2 text-xs font-semibold text-right tabular-nums ${
                  entry.type === "PAYMENT" ? "text-success" : entry.type === "CHARGE" ? "text-danger" : "text-primary"
                }">${formatMoney(entry.amount)}</td>
                <td class="px-3 py-2 text-xs whitespace-nowrap">${formatDate(entry.occurredAt)}</td>
                <td class="px-3 py-2 text-xs">${entry.note || "-"}</td>
              </tr>
            `
              )
              .join("")
            : `<tr><td colspan="4" class="px-3 py-8 text-center text-xs text-muted">No ledger activity yet. Add a debt or record a payment to start this customer's financial timeline.</td></tr>`;

        const bookingsRows = customer.customerBookings || [];
        const bookingsHtml =
          bookingsRows.length > 0
            ? bookingsRows
              .map(
                (b) => `
              <tr class="border-b border-white/10 hover:bg-slate-800/40 transition-colors">
                <td class="px-3 py-2 text-xs">
                  <div class="font-semibold">${b.serviceNameSnapshotEn}</div>
                </td>
                <td class="px-3 py-2 text-xs">${bookingStatusBadge(b.status)}</td>
                <td class="px-3 py-2 text-xs whitespace-nowrap">${formatDate(b.appointmentAt)}</td>
                <td class="px-3 py-2 text-xs font-semibold text-right tabular-nums">${formatMoney(b.finalPrice)}</td>
              </tr>
            `
              )
              .join("")
            : `<tr><td colspan="4" class="px-3 py-8 text-center text-xs text-muted">No bookings recorded yet. Upcoming and past visits will appear here once scheduled.</td></tr>`;

        const loyalty = customer.loyalty || {};
        const loyaltyProgressRows = loyalty.progress || [];
        const loyaltyAvailableRows = loyalty.availableRewards || [];
        const loyaltyHistoryRows = loyalty.rewardHistory || [];

        const completedStatuses = ["completed", "done", "finished", "served"];
        const cancelledStatuses = ["cancelled", "canceled", "rejected", "no_show", "no-show", "not_served", "not-served"];
        const pendingStatuses = ["pending", "requested", "draft", "scheduled", "approved", "accepted", "in_progress", "in-progress"];

        const totalServices = Number(customer.totalBookings ?? customer.totalServices ?? bookingsRows.length ?? 0);
        const totalPaid = Number(customer.totalPaid ?? 0);
        const currentDebt = Number(customer.balanceDue || 0);
        const lastVisit = customer.lastActivityDate || customer.lastVisitAt || null;
        const customerStatus = String(customer.status || "active").toUpperCase();
        const customerId = customer.id || id;
        const debtTone = currentDebt > 0 ? "text-danger" : currentDebt < 0 ? "text-success" : "text-text";

        const completedServices =
          customer.completedJobs ??
          bookingsRows.filter((b) => completedStatuses.includes(String(b.status || "").toLowerCase())).length;
        const pendingServices = bookingsRows.filter((b) => pendingStatuses.includes(String(b.status || "").toLowerCase())).length;
        const cancelledServices = bookingsRows.filter((b) => cancelledStatuses.includes(String(b.status || "").toLowerCase())).length;

        const totalCharges =
          customer.totalServicesCost ??
          ledgerRows
            .filter((entry) => String(entry.type || "").toUpperCase() === "CHARGE")
            .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
        const paymentEntries = ledgerRows.filter((entry) => String(entry.type || "").toUpperCase() === "PAYMENT");
        const lastPaymentDate =
          paymentEntries
            .map((entry) => entry.occurredAt)
            .filter(Boolean)
            .sort((a, b) => new Date(b) - new Date(a))[0] || null;
        const averageServiceValue = completedServices > 0 ? totalCharges / completedServices : null;

        const customerVehicles = [];
        if (customer.carCompany || customer.carModel || customer.carYear || customer.carType || customer.licensePlate) {
          customerVehicles.push({
            model: [customer.carCompany, customer.carModel].filter(Boolean).join(" ") || "Vehicle",
            year: customer.carYear || null,
            engineType: normalizeVehicleFuelType(customer.carType),
            propulsion: normalizeVehicleFuelType(customer.carType),
            licensePlate: customer.licensePlate || null
          });
        }

        const loyaltyHasData =
          Number(loyalty.totalValidVisits || 0) > 0 ||
          Number(loyalty.completedServicesCount || 0) > 0 ||
          loyaltyProgressRows.length > 0 ||
          loyaltyAvailableRows.length > 0 ||
          loyaltyHistoryRows.length > 0;

        const bookingActivityEvents = bookingsRows.map((booking) => {
          const statusKey = String(booking.status || "").toLowerCase();
          const isCompleted = completedStatuses.includes(statusKey);
          const isCancelled = cancelledStatuses.includes(statusKey);
          const eventTitle = isCompleted ? "Service completed" : isCancelled ? "Booking cancelled" : "Booking created";
          const iconType = isCompleted ? "service" : isCancelled ? "cancelled" : "booking";
          return {
            iconType,
            title: eventTitle,
            description: booking.serviceNameSnapshotEn || "Service",
            amount: isCompleted ? Number(booking.finalPrice || 0) : null,
            date: booking.appointmentAt || booking.updatedAt || booking.createdAt || null
          };
        });

        const ledgerActivityEvents = ledgerRows
          .map((entry) => {
            const entryType = String(entry.type || "").toUpperCase();
            if (entryType === "PAYMENT") {
              return {
                iconType: "payment",
                title: "Payment recorded",
                description: entry.note || "Customer payment",
                amount: Number(entry.amount || 0),
                date: entry.occurredAt || entry.createdAt || null
              };
            }
            if (entryType === "CHARGE") {
              return {
                iconType: "debt",
                title: "Debt added",
                description: entry.note || "Manual charge",
                amount: Number(entry.amount || 0),
                date: entry.occurredAt || entry.createdAt || null
              };
            }
            if (entryType === "ADJUSTMENT") {
              return {
                iconType: "debt",
                title: "Balance adjusted",
                description: entry.note || "Manual adjustment",
                amount: Number(entry.amount || 0),
                date: entry.occurredAt || entry.createdAt || null
              };
            }
            return null;
          })
          .filter(Boolean);

        const recentActivityEvents = [...ledgerActivityEvents, ...bookingActivityEvents]
          .filter((event) => event.date)
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 5);
        const recentActivityHtml =
          recentActivityEvents.length > 0
            ? recentActivityEvents
                .map(
                  (event) => `
                  <div class="flex items-start gap-3 rounded-lg border-b border-white/10 py-2.5 last:border-b-0 hover:bg-white/5 transition-colors">
                    <div class="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-bg/30">
                      ${activityIcon(event.iconType)}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="text-xs font-semibold text-text">${event.title}</div>
                      <div class="text-xs text-muted truncate">${event.description || "-"}</div>
                      <div class="mt-1 flex items-center gap-2">
                        <div class="text-[11px] text-muted whitespace-nowrap">${formatDate(event.date)}</div>
                        ${event.amount != null ? `<div class="text-[11px] font-semibold tabular-nums text-text">${formatMoney(event.amount)}</div>` : ""}
                      </div>
                    </div>
                  </div>
                `
                )
                .join("")
            : `<div class="text-xs text-muted py-3">No activity recorded yet. New bookings, services, debts, and payments will appear here.</div>`;

        content.innerHTML = `
          <div class="rounded-xl border border-white/10 bg-bg/30 p-4 mb-4">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                ${
                  customer.avatarUrl
                    ? `<img src="${customer.avatarUrl}" class="w-14 h-14 rounded-xl object-cover border border-white/10" alt="avatar">`
                    : `<div class="w-14 h-14 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center border border-white/10 text-lg">${(customer.fullName || "C").charAt(0).toUpperCase()}</div>`
                }
                <div class="min-w-0">
                  <div class="text-base font-bold text-text truncate">${customer.fullName || "Unnamed Customer"}</div>
                  <div class="text-xs text-muted truncate">${customer.phone || "-"}</div>
                  <div class="mt-1 flex items-center gap-2 text-[11px] text-muted">
                    <span>Customer ID</span>
                    <button
                      class="inline-flex items-center gap-1 rounded-md border border-white/10 bg-bg/30 px-1.5 py-0.5 text-[10px] font-semibold text-text hover:bg-bg/50 transition-colors"
                      onclick="window.copyCustomerId('${customerId}')"
                      title="Copy customer ID"
                      type="button"
                    >
                      <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 8h11v11H8z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 16H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1"></path>
                      </svg>
                      Copy ID
                    </button>
                  </div>
                </div>
              </div>
              <div class="shrink-0">${statusBadge(customer.status)}</div>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
            <div class="h-full rounded-xl border border-white/10 bg-bg/30 p-3">
              <div class="text-[10px] uppercase tracking-wider text-muted">Total Services</div>
              <div class="mt-1 text-lg font-semibold text-text tabular-nums">${totalServices}</div>
            </div>
            <div class="h-full rounded-xl border border-white/10 bg-bg/30 p-3">
              <div class="text-[10px] uppercase tracking-wider text-muted">Total Paid</div>
              <div class="mt-1 text-lg font-semibold text-text tabular-nums">${formatMoney(totalPaid)}</div>
            </div>
            <div class="h-full rounded-xl border border-white/10 bg-bg/30 p-3">
              <div class="text-[10px] uppercase tracking-wider text-muted">Current Debt</div>
              <div class="mt-1 text-lg font-semibold tabular-nums ${debtTone}">${formatMoney(currentDebt)}</div>
            </div>
            <div class="h-full rounded-xl border border-white/10 bg-bg/30 p-3">
              <div class="text-[10px] uppercase tracking-wider text-muted">Last Visit</div>
              <div class="mt-1 text-lg font-semibold text-text">${lastVisit ? formatDate(lastVisit) : "No visits yet"}</div>
            </div>
          </div>

          <!-- Tabs Header -->
          <div class="rounded-xl border border-white/10 bg-bg/30 p-1 mb-5">
            <div class="grid grid-cols-3 gap-1">
              <button id="customer-tab-btn-overview" onclick="window.switchCustomerTab('overview')" class="customer-tab-btn rounded-lg px-3 py-2 text-sm font-bold border-b-2 transition-colors bg-slate-800/50 text-text border-primary">Overview</button>
              <button id="customer-tab-btn-ledger" onclick="window.switchCustomerTab('ledger')" class="customer-tab-btn rounded-lg px-3 py-2 text-sm font-semibold border-b-2 transition-colors border-transparent text-muted hover:text-text hover:bg-slate-800/40">Ledger</button>
              <button id="customer-tab-btn-bookings" onclick="window.switchCustomerTab('bookings')" class="customer-tab-btn rounded-lg px-3 py-2 text-sm font-semibold border-b-2 transition-colors border-transparent text-muted hover:text-text hover:bg-slate-800/40">Bookings</button>
            </div>
          </div>

          <!-- Tab: Overview -->
          <div id="customer-tab-overview" class="customer-tab-content space-y-6 animate-in fade-in">
            <section class="rounded-xl border border-white/10 bg-bg/30 p-4">
              <div class="text-[11px] font-semibold uppercase tracking-wider text-muted mb-3">Actions</div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <button class="h-11 px-3 rounded-xl border border-danger/35 bg-transparent text-danger text-xs font-semibold hover:bg-danger/15 transition-colors inline-flex items-center justify-center gap-1.5" onclick="window.customerLedgerAction('${id}','CHARGE')">
                  <span aria-hidden="true">+</span>
                  <span>Add Debt</span>
                </button>
                <button class="h-11 px-3 rounded-xl border border-success/35 bg-transparent text-success text-xs font-semibold hover:bg-success/15 transition-colors inline-flex items-center justify-center gap-1.5" onclick="window.customerLedgerAction('${id}','PAYMENT')">
                  <span aria-hidden="true">&darr;</span>
                  <span>Record Payment</span>
                </button>
                <button class="h-11 px-3 rounded-xl border border-primary/40 bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors inline-flex items-center justify-center gap-1.5" onclick="window.createCustomerBooking('${id}')">
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"></path>
                  </svg>
                  <span>Create Booking</span>
                </button>
              </div>
            </section>

            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <section class="rounded-xl border border-white/10 bg-bg/30 p-4">
                <div class="text-sm font-bold mb-3">Account Summary</div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <div class="text-[10px] uppercase tracking-wider text-muted">Phone</div>
                    <div class="font-semibold text-text mt-1">${customer.phone || "-"}</div>
                  </div>
                  <div>
                    <div class="text-[10px] uppercase tracking-wider text-muted">Customer ID</div>
                    <div class="mt-1 flex items-center gap-2">
                      <button
                        class="inline-flex items-center gap-1 rounded-md border border-white/10 bg-bg/30 px-1.5 py-0.5 text-[10px] font-semibold text-text hover:bg-bg/50 transition-colors"
                        onclick="window.copyCustomerId('${customerId}')"
                        title="Copy customer ID"
                        type="button"
                      >
                        <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M8 8h11v11H8z"></path>
                          <path stroke-linecap="round" stroke-linejoin="round" d="M5 16H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1"></path>
                        </svg>
                        Copy ID
                      </button>
                    </div>
                  </div>
                  <div>
                    <div class="text-[10px] uppercase tracking-wider text-muted">Joined Date</div>
                    <div class="font-semibold text-text mt-1">${formatDate(customer.joinedAt)}</div>
                  </div>
                  <div>
                    <div class="text-[10px] uppercase tracking-wider text-muted">Status</div>
                    <div class="mt-1">${statusBadge(customerStatus.toLowerCase())}</div>
                  </div>
                </div>
              </section>

              <section class="rounded-xl border border-white/10 bg-bg/30 p-4">
                <div class="text-sm font-bold mb-3">Financial Summary</div>
                <div class="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div class="text-[10px] uppercase tracking-wider text-muted">Total Paid</div>
                    <div class="font-semibold text-text mt-1 tabular-nums">${formatMoney(totalPaid)}</div>
                  </div>
                  <div>
                    <div class="text-[10px] uppercase tracking-wider text-muted">Total Charges</div>
                    <div class="font-semibold text-text mt-1 tabular-nums">${formatMoney(totalCharges)}</div>
                  </div>
                  <div>
                    <div class="text-[10px] uppercase tracking-wider text-muted">Current Debt</div>
                    <div class="font-semibold mt-1 tabular-nums ${debtTone}">${formatMoney(currentDebt)}</div>
                  </div>
                  <div>
                    <div class="text-[10px] uppercase tracking-wider text-muted">Last Payment Date</div>
                    <div class="font-semibold text-text mt-1">${lastPaymentDate ? formatDate(lastPaymentDate) : "No payments yet"}</div>
                  </div>
                  <div class="col-span-2 rounded-lg border border-white/10 bg-bg/20 p-2.5">
                    <div class="text-[10px] uppercase tracking-wider text-muted">Average Service Value</div>
                    <div class="mt-1 text-sm font-semibold text-text tabular-nums">${averageServiceValue != null ? formatMoney(averageServiceValue) : "Not enough data yet"}</div>
                  </div>
                </div>
              </section>

              <section class="rounded-xl border border-white/10 bg-bg/30 p-4">
                <div class="text-sm font-bold mb-3">Recent Activity</div>
                <div>${recentActivityHtml}</div>
              </section>

              <section class="rounded-xl border border-white/10 bg-bg/30 p-4">
                <div class="text-sm font-bold mb-3">Service Statistics</div>
                <div class="grid grid-cols-2 gap-2.5">
                  <div class="h-full rounded-lg border border-white/10 bg-bg/20 p-3">
                    <div class="text-[10px] uppercase tracking-wider text-muted">Total Services</div>
                    <div class="mt-1 text-2xl font-bold text-text tabular-nums">${totalServices}</div>
                  </div>
                  <div class="h-full rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3">
                    <div class="text-[10px] uppercase tracking-wider text-emerald-400">Completed</div>
                    <div class="mt-1 text-2xl font-bold text-emerald-400 tabular-nums">${completedServices}</div>
                  </div>
                  <div class="h-full rounded-lg border border-amber-500/25 bg-amber-500/10 p-3">
                    <div class="text-[10px] uppercase tracking-wider text-amber-400">Pending</div>
                    <div class="mt-1 text-2xl font-bold text-amber-400 tabular-nums">${pendingServices}</div>
                  </div>
                  <div class="h-full rounded-lg border border-danger/25 bg-danger/10 p-3">
                    <div class="text-[10px] uppercase tracking-wider text-danger">Cancelled</div>
                    <div class="mt-1 text-2xl font-bold text-danger tabular-nums">${cancelledServices}</div>
                  </div>
                </div>
              </section>

              <section class="rounded-xl border border-white/10 bg-bg/30 p-4">
                <div class="text-sm font-bold mb-3">Customer Vehicles</div>
                ${
                  customerVehicles.length > 0
                    ? `
                    <div class="grid grid-cols-1 gap-2.5">
                      ${customerVehicles
                        .map(
                          (vehicle) => `
                          <article class="rounded-xl border border-white/10 bg-bg/20 p-3 h-full">
                            <div class="text-sm font-semibold text-text">${vehicle.model}${vehicle.year ? ` ${vehicle.year}` : ""}</div>
                            <div class="mt-1 text-xs text-muted">${vehicle.engineType}</div>
                            <div class="mt-1 text-xs text-muted">${vehicle.propulsion}</div>
                            <div class="mt-1 text-xs text-text">${vehicle.licensePlate ? `Plate: ${vehicle.licensePlate}` : "Plate: Not provided"}</div>
                          </article>
                        `
                        )
                        .join("")}
                    </div>
                  `
                    : `
                    <div class="rounded-xl border border-dashed border-white/10 bg-bg/20 p-4 text-xs text-muted">
                      <div>No vehicles added yet.</div>
                      <button class="mt-3 h-9 px-3 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors text-xs font-semibold" onclick="window.addCustomerVehicle('${id}')">Add Vehicle</button>
                    </div>
                  `
                }
              </section>

              <section class="rounded-xl border border-white/10 bg-bg/30 p-4">
                <div class="text-sm font-bold mb-3">Loyalty & Rewards</div>
                ${
                  loyaltyHasData
                    ? `
                    <div class="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div class="rounded-lg border border-white/10 bg-bg/20 p-2.5">
                        <div class="text-[10px] uppercase tracking-wider text-muted">Valid Visits</div>
                        <div class="mt-1 text-base font-bold text-text tabular-nums">${loyalty.totalValidVisits ?? 0}</div>
                      </div>
                      <div class="rounded-lg border border-white/10 bg-bg/20 p-2.5">
                        <div class="text-[10px] uppercase tracking-wider text-muted">Completed Services</div>
                        <div class="mt-1 text-base font-bold text-text tabular-nums">${loyalty.completedServicesCount ?? 0}</div>
                      </div>
                      <div class="rounded-lg border border-white/10 bg-bg/20 p-2.5">
                        <div class="text-[10px] uppercase tracking-wider text-muted">Active Progress</div>
                        <div class="mt-1 text-base font-bold text-text tabular-nums">${loyaltyProgressRows.length}</div>
                      </div>
                      <div class="rounded-lg border border-white/10 bg-bg/20 p-2.5">
                        <div class="text-[10px] uppercase tracking-wider text-muted">Reward History</div>
                        <div class="mt-1 text-base font-bold text-text tabular-nums">${loyaltyHistoryRows.length}</div>
                      </div>
                    </div>
                  `
                    : `<div class="rounded-xl border border-dashed border-white/10 bg-bg/20 p-4 text-xs text-muted">Loyalty rewards will appear here once visits accumulate.</div>`
                }
              </section>
            </div>
          </div>

          <!-- Tab: Ledger -->
          <div id="customer-tab-ledger" class="customer-tab-content hidden animate-in fade-in">
            <div class="max-h-[400px] overflow-auto border border-white/10 rounded-xl">
              <table class="w-full text-left">
                <thead class="sticky top-0 bg-bg border-b border-white/10">
                  <tr>
                    <th class="px-3 py-2 text-[10px] uppercase text-muted">Type</th>
                    <th class="px-3 py-2 text-[10px] uppercase text-muted text-right">Amount</th>
                    <th class="px-3 py-2 text-[10px] uppercase text-muted">Date</th>
                    <th class="px-3 py-2 text-[10px] uppercase text-muted">Note</th>
                  </tr>
                </thead>
                <tbody>${ledgerHtml}</tbody>
              </table>
            </div>
          </div>

          <!-- Tab: Bookings -->
          <div id="customer-tab-bookings" class="customer-tab-content hidden animate-in fade-in">
            <div class="max-h-[400px] overflow-auto border border-white/10 rounded-xl">
              <table class="w-full text-left">
                <thead class="sticky top-0 bg-bg border-b border-white/10">
                  <tr>
                    <th class="px-3 py-2 text-[10px] uppercase text-muted">Service</th>
                    <th class="px-3 py-2 text-[10px] uppercase text-muted">Status</th>
                    <th class="px-3 py-2 text-[10px] uppercase text-muted">Date</th>
                    <th class="px-3 py-2 text-[10px] uppercase text-muted text-right">Price</th>
                  </tr>
                </thead>
                <tbody>${bookingsHtml}</tbody>
              </table>
            </div>
          </div>
        `;
      } catch (error) {
        content.innerHTML = `<div class="py-10 text-center text-danger text-sm">${error.message}</div>`;
      }
    }

    window.openCustomerDetails = (id) => {
      loadCustomerDetails(id);
    };

    window.switchCustomerTab = (tabId) => {
      document.querySelectorAll('.customer-tab-content').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.customer-tab-btn').forEach(el => {
        el.classList.remove('border-primary', 'text-text', 'font-bold', 'bg-slate-800/50');
        el.classList.add('border-transparent', 'text-muted', 'font-semibold');
      });
      document.getElementById(`customer-tab-${tabId}`).classList.remove('hidden');
      const activeBtn = document.getElementById(`customer-tab-btn-${tabId}`);
      if (activeBtn) {
        activeBtn.classList.remove('border-transparent', 'text-muted', 'font-semibold');
        activeBtn.classList.add('border-primary', 'text-text', 'font-bold', 'bg-slate-800/50');
      }
    };

    window.openCustomerActionModal = (id, actionType) => {
      state.currentActionId = id;
      state.currentActionType = actionType;

      const modal = document.getElementById('customer-action-modal');
      const title = document.getElementById('customer-action-title');
      const desc = document.getElementById('customer-action-desc');
      const extraFields = document.getElementById('customer-action-extra-fields');
      const noteInput = document.getElementById('customer-action-note');
      const submitBtn = document.getElementById('customer-action-submit');

      noteInput.value = '';
      extraFields.innerHTML = '';

      if (actionType === 'suspend') {
        title.textContent = "Suspend Customer";
        desc.textContent = "Are you sure you want to suspend this customer? They will not be able to log in or book services.";
        noteInput.placeholder = "Reason for suspension (Optional)";
        submitBtn.className = "px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold";
      } else if (actionType === 'ban') {
        title.textContent = "Ban Customer";
        desc.textContent = "Banning a customer prevents them from using the platform entirely.";

        extraFields.innerHTML = `
          <input id="ban-duration-input" type="number" placeholder="Duration in days (leave empty for permanent)" class="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm mb-3">
          <input id="ban-message-input" type="text" placeholder="Message shown to user (Optional)" class="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm">
        `;
        noteInput.placeholder = "Internal ban reason (Optional)";
        submitBtn.className = "px-4 py-2 rounded-lg bg-danger text-white font-semibold";
      } else if (actionType === 'reset_password') {
        title.textContent = "Reset Password";
        desc.textContent = "This will generate a new temporary password for the customer.";
        noteInput.placeholder = "Reason for reset (Optional)";
        submitBtn.className = "px-4 py-2 rounded-lg bg-primary text-white font-semibold";
      } else if (actionType === 'activate') {
        title.textContent = "Activate Customer";
        desc.textContent = "Reactivate this customer account?";
        noteInput.placeholder = "Note (Optional)";
        submitBtn.className = "px-4 py-2 rounded-lg bg-success text-white font-semibold";
      } else if (actionType === 'CHARGE') {
        title.textContent = "Add Debt";
        desc.textContent = "Add an outstanding charge to this customer's ledger.";
        extraFields.innerHTML = `<input id="ledger-amount-input" type="number" step="0.01" placeholder="Amount (JOD)" class="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm" required>`;
        noteInput.placeholder = "Reason/Note (Required)";
        submitBtn.className = "px-4 py-2 rounded-lg bg-danger text-white font-semibold";
      } else if (actionType === 'PAYMENT') {
        title.textContent = "Record Payment";
        desc.textContent = "Record a payment received from this customer.";
        extraFields.innerHTML = `<input id="ledger-amount-input" type="number" step="0.01" placeholder="Amount (JOD)" class="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm" required>`;
        noteInput.placeholder = "Payment reference/note (Optional)";
        submitBtn.className = "px-4 py-2 rounded-lg bg-success text-white font-semibold";
      } else if (actionType === 'ADJUSTMENT') {
        title.textContent = "Record Adjustment";
        desc.textContent = "Make a manual adjustment to the ledger. Use negative values to reduce debt without logging a payment.";
        extraFields.innerHTML = `<input id="ledger-amount-input" type="number" step="0.01" placeholder="Amount (JOD)" class="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm" required>`;
        noteInput.placeholder = "Reason (Required)";
        submitBtn.className = "px-4 py-2 rounded-lg bg-primary text-white font-semibold";
      }

      submitBtn.textContent = 'Confirm';

      modal.classList.remove('hidden');
      modal.classList.add('flex');
    };

    window.closeCustomerActionModal = () => {
      const modal = document.getElementById('customer-action-modal');
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      state.currentActionId = null;
      state.currentActionType = null;
    };

    window.submitCustomerAction = async () => {
      const id = state.currentActionId;
      const action = state.currentActionType;
      const note = document.getElementById('customer-action-note').value.trim();
      const submitBtn = document.getElementById('customer-action-submit');

      if (!id || !action) return;

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<svg class="animate-spin h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>`;

      try {
        if (['CHARGE', 'PAYMENT', 'ADJUSTMENT'].includes(action)) {
          const amtInput = document.getElementById('ledger-amount-input');
          if (!amtInput || !amtInput.value) {
            window.toast("Amount is required.", "error");
            throw new Error("Validation failed");
          }

          await apiFetch(`/admin/customers/${id}/ledger`, {
            method: "POST",
            body: {
              type: action,
              amount: Number(amtInput.value),
              note
            }
          });
          window.toast("Ledger updated", "success");
        } else {
          // Status Actions
          if (action === "suspend") {
            await apiFetch(`/admin/customers/${id}`, { method: "PATCH", body: { action, reason: note || undefined } });
          } else if (action === "ban") {
            const durationInput = document.getElementById('ban-duration-input')?.value;
            const message = document.getElementById('ban-message-input')?.value;
            await apiFetch(`/admin/customers/${id}`, {
              method: "PATCH",
              body: {
                action,
                durationDays: durationInput ? Number(durationInput) : undefined,
                banMessage: message || undefined,
                banReason: note || undefined
              }
            });
          } else if (action === "reset_password") {
            const result = await apiFetch(`/admin/users/${id}/password-reset`, {
              method: "POST",
              body: { forceOnly: false }
            });
            if (result.temporaryPassword) {
              await AlertModal({
                title: "Password Reset Generated",
                message: `Temporary password: ${result.temporaryPassword}`,
                intent: "success",
                confirmText: "Close"
              });
              try { await navigator.clipboard.writeText(result.temporaryPassword); } catch (e) { }
            }
          } else {
            await apiFetch(`/admin/customers/${id}`, { method: "PATCH", body: { action } });
          }
          window.toast("Customer updated", "success");
        }

        window.closeCustomerActionModal();
        await loadCustomers();
        if (!document.getElementById("customer-details-drawer").classList.contains("hidden")) {
          await loadCustomerDetails(id);
        }
      } catch (error) {
        if (error.message !== "Validation failed") window.toast(error.message, "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirm';
      }
    };

    window.customerAction = (id, action) => {
      window.openCustomerActionModal(id, action);
    };

    window.customerLedgerAction = (id, type) => {
      window.openCustomerActionModal(id, type);
    };

    window.createCustomerBooking = (customerId) => {
      try {
        sessionStorage.setItem(
          "admin-bookings-prefill",
          JSON.stringify({
            customerId
          })
        );
      } catch (_error) {
      }
      if (typeof window.navigate === "function") {
        window.navigate(null, "/admin/bookings");
      }
      window.toast("Redirected to Booking Operations to create a booking for this customer.", "success");
    };

    window.addCustomerVehicle = async (customerId) => {
      const carCompany = prompt("Vehicle brand (e.g., Toyota):", "");
      if (carCompany === null) return;
      const carModel = prompt("Vehicle model (e.g., Camry):", "");
      if (carModel === null) return;
      const carYear = prompt("Vehicle year (e.g., 2011):", "");
      if (carYear === null) return;
      const carType = prompt("Engine type (EV / Hybrid / Fuel):", "");
      if (carType === null) return;

      const hasAnyValue = [carCompany, carModel, carYear, carType].some((value) => String(value || "").trim().length > 0);
      if (!hasAnyValue) {
        window.toast("Vehicle details were empty, nothing was saved.", "error");
        return;
      }

      try {
        await apiFetch(`/admin/customers/${customerId}`, {
          method: "PATCH",
          body: {
            action: "update_profile",
            carCompany: carCompany.trim() || null,
            carModel: carModel.trim() || null,
            carYear: carYear.trim() || null,
            carType: carType.trim() || null
          }
        });
        window.toast("Vehicle details saved.", "success");
        await loadCustomerDetails(customerId);
      } catch (error) {
        window.toast(error.message || "Failed to save vehicle details.", "error");
      }
    };

    window.copyCustomerId = async (customerId) => {
      try {
        await navigator.clipboard.writeText(String(customerId || ""));
        window.toast("Customer ID copied.", "success");
      } catch (_error) {
        window.toast("Could not copy customer ID.", "error");
      }
    };

    document.getElementById("close-customer-drawer").addEventListener("click", () => {
      document.getElementById("customer-details-drawer").classList.add("hidden");
      document.getElementById("customer-details-drawer").classList.remove("flex");
    });

    queryInput.addEventListener("input", (event) => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        state.q = event.target.value.trim();
        state.page = 1;
        loadCustomers();
      }, 300);
    });

    statusFilter.addEventListener("change", (event) => {
      state.status = event.target.value;
      state.page = 1;
      loadCustomers();
    });

    joinFromFilter.addEventListener("change", (event) => {
      state.joinFrom = event.target.value;
      state.page = 1;
      loadCustomers();
    });

    joinToFilter.addEventListener("change", (event) => {
      state.joinTo = event.target.value;
      state.page = 1;
      loadCustomers();
    });

    createToggle.addEventListener("click", () => {
      createContainer.classList.remove("hidden");
      createContainer.classList.add("flex");
      requestAnimationFrame(() => createFullNameInput?.focus());
    });

    createForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.target;
      if (!validateCreatePhone()) return;
      if (state.duplicateBlocked) {
        window.toast("Duplicate phone detected.", "error");
        return;
      }
      if (!LOCAL_PHONE_REGEX.test(form.phone.value.trim())) {
        window.toast("Phone must start with 07 and contain 10 digits.", "error");
        return;
      }
      createSubmitBtn.disabled = true;
      createSubmitBtn.textContent = "Saving...";
      try {
        await apiFetch("/admin/customers", {
          method: "POST",
          body: {
            fullName: form.fullName.value,
            phone: form.phone.value,
            password: form.password.value || undefined,
            location: form.location.value || undefined,
            initialDebt: form.initialDebt.value ? Number(form.initialDebt.value) : undefined,
            initialDebtNote: form.initialDebtNote.value || undefined,
            initialPayment: form.initialPayment.value ? Number(form.initialPayment.value) : undefined
          }
        });
        form.reset();
        window.closeCustomerCreateModal();
        window.toast("Customer created", "success");
        loadCustomers();
      } catch (error) {
        window.toast(error.message, "error");
      } finally {
        createSubmitBtn.disabled = false;
        createSubmitBtn.textContent = "Save";
      }
    });

    customerPhoneInput.addEventListener("input", () => {
      customerPhoneInput.value = customerPhoneInput.value.replace(/\D/g, "").slice(0, 10);
      validateCreatePhone();
      clearTimeout(duplicateDebounce);
      duplicateDebounce = setTimeout(checkCustomerPhoneDuplicate, 250);
    });

    loadCustomers();

    if (window.location.hash === '#create-customer') {
      createContainer.classList.remove('hidden');
      createContainer.classList.add('flex');
      requestAnimationFrame(() => createFullNameInput?.focus());
    }

    window.closeCustomerCreateModal = () => {
      createContainer.classList.add("hidden");
      createContainer.classList.remove("flex");
      createForm.reset();
      phoneError.classList.add("hidden");
      phoneError.textContent = "";
      duplicateWarning.classList.add("hidden");
      state.duplicateBlocked = false;
      state.phoneInvalid = false;
      createSubmitBtn.disabled = false;
      createSubmitBtn.textContent = "Save";
    };
  };

  return `
    <div class="w-full flex flex-col gap-5 relative">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-surface border border-border rounded-xl p-4">
        <div>
          <h1 class="text-2xl font-heading font-bold">Customers</h1>
          <p class="text-sm text-muted">Search, filter, and manage customer accounts and debts.</p>
        </div>
        <button id="toggle-customer-create" class="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover">Create Customer</button>
      </div>

      <!-- Create Customer Modal -->
      <div id="customer-create-container" class="fixed inset-0 z-[100] hidden items-center justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-surface border border-border rounded-xl p-6 w-full max-w-2xl shadow-2xl relative animate-in zoom-in-95">
          <button onclick="window.closeCustomerCreateModal()" class="absolute top-4 right-4 w-8 h-8 rounded-full border border-border hover:bg-bg flex items-center justify-center text-muted hover:text-text transition-colors">&times;</button>
          <h3 class="text-xl font-bold mb-1">Create Customer</h3>
          <p class="text-sm text-muted mb-4">Add a new customer account with optional opening balance details.</p>
          <form id="customer-create-form" class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-muted uppercase tracking-wide">Full Name</label>
              <input id="customer-create-full-name" name="fullName" required placeholder="Full Name" class="w-full px-3 py-2 rounded-lg border border-border bg-bg">
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-muted uppercase tracking-wide">Phone</label>
              <input id="customer-create-phone" name="phone" required maxlength="10" pattern="07[0-9]{8}" inputmode="numeric" autocomplete="off" placeholder="07XXXXXXXX" class="w-full px-3 py-2 rounded-lg border border-border bg-bg">
              <p id="customer-phone-error" class="hidden text-[11px] text-danger">Phone must start with 07 and contain exactly 10 digits.</p>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-muted uppercase tracking-wide">Location</label>
              <input name="location" placeholder="Location" class="w-full px-3 py-2 rounded-lg border border-border bg-bg">
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-muted uppercase tracking-wide">Password (Optional)</label>
              <input name="password" placeholder="Password (optional)" class="w-full px-3 py-2 rounded-lg border border-border bg-bg">
              <p class="text-[11px] text-muted">Only needed if the customer will log in.</p>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-muted uppercase tracking-wide">Initial Debt</label>
              <div class="relative">
                <input name="initialDebt" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0.00" class="w-full px-3 py-2 pr-12 rounded-lg border border-border bg-bg text-sm">
                <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">JOD</span>
              </div>
              <p class="text-[11px] text-muted">Amount the customer already owes.</p>
            </div>
            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-muted uppercase tracking-wide">Initial Payment</label>
              <div class="relative">
                <input name="initialPayment" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0.00" class="w-full px-3 py-2 pr-12 rounded-lg border border-border bg-bg text-sm">
                <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">JOD</span>
              </div>
              <p class="text-[11px] text-muted">Initial Payment reduces the starting debt.</p>
            </div>

            <div class="md:col-span-2 space-y-1.5">
              <label class="text-xs font-semibold text-muted uppercase tracking-wide">Initial Debt Note</label>
              <input name="initialDebtNote" placeholder="Initial Debt Note" class="w-full px-3 py-2 rounded-lg border border-border bg-bg">
              <p class="text-[11px] text-muted">Optional note for the initial balance.</p>
            </div>
            <div id="customer-duplicate-warning" class="hidden md:col-span-2 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2"></div>
            <div class="md:col-span-2 flex items-center justify-end gap-2 pt-4 mt-1 border-t border-border">
               <button type="button" onclick="window.closeCustomerCreateModal()" class="px-4 py-2 rounded-lg border border-border text-sm font-semibold text-muted hover:text-text hover:border-primary/40 transition-colors">Cancel</button>
               <button id="customer-create-submit" class="px-6 py-2 rounded-lg bg-primary text-white text-sm font-semibold shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_6px_18px_rgba(24,119,242,0.35)] hover:bg-primary-hover transition-colors">Save</button>
            </div>
          </form>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input id="customers-search" placeholder="Search by name or phone" class="md:col-span-2 px-3 py-2 rounded-lg border border-border bg-surface">
        <select id="customers-status" class="px-3 py-2 rounded-lg border border-border bg-surface">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
        <div class="grid grid-cols-2 gap-2">
          ${DateInput({ id: 'customers-join-from', className: 'w-full px-3 py-2 rounded-lg border border-border bg-surface' })}
          ${DateInput({ id: 'customers-join-to', className: 'w-full px-3 py-2 rounded-lg border border-border bg-surface' })}
        </div>
      </div>

      <div class="bg-surface border border-border rounded-xl overflow-hidden">
        <div class="overflow-auto">
          <table class="w-full min-w-[1200px] text-left">
            <thead class="bg-bg border-b border-border">
              <tr>
                <th class="px-5 py-3 text-xs uppercase text-muted">Customer</th>
                <th class="px-5 py-3 text-xs uppercase text-muted">Phone</th>
                <th class="px-5 py-3 text-xs uppercase text-muted">Joined</th>
                <th class="px-5 py-3 text-xs uppercase text-muted">Status</th>
                <th class="px-5 py-3 text-xs uppercase text-muted">Total Paid</th>
                <th class="px-5 py-3 text-xs uppercase text-muted">Services Cost</th>
                <th class="px-5 py-3 text-xs uppercase text-muted text-center">Jobs</th>
                <th class="px-5 py-3 text-xs uppercase text-muted">Last Activity</th>
                <th class="px-5 py-3 text-xs uppercase text-muted">Debt</th>
                <th class="px-5 py-3 text-xs uppercase text-muted text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="customers-tbody"></tbody>
          </table>
        </div>
      </div>

      <div id="customers-pagination" class="flex items-center justify-between"></div>

      <div id="customer-details-drawer" class="fixed inset-0 z-[70] hidden items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto pt-10 pb-10">
        <div class="bg-surface border border-border rounded-xl p-6 w-full max-w-2xl shadow-2xl relative animate-in zoom-in-95 my-auto">
          <button id="close-customer-drawer" class="absolute top-4 right-4 w-8 h-8 rounded-full border border-border hover:bg-bg flex items-center justify-center text-muted hover:text-text transition-colors">&times;</button>
          <h3 id="customer-drawer-title" class="text-xl font-bold mb-4">Customer</h3>
          <div id="customer-details-content" class="relative z-0"></div>
        </div>
      </div>

      <!-- Customer Action Modal -->
      <div id="customer-action-modal" class="fixed inset-0 z-[100] hidden items-center justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-surface border border-border rounded-xl p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95">
           <button onclick="window.closeCustomerActionModal()" class="absolute top-4 right-4 w-8 h-8 rounded-full border border-border hover:bg-bg flex items-center justify-center text-muted hover:text-text transition-colors">&times;</button>
           <h3 id="customer-action-title" class="text-xl font-bold mb-2">Confirm Action</h3>
           <p id="customer-action-desc" class="text-sm text-muted mb-5 leading-relaxed">Are you sure you want to proceed?</p>
           
           <div class="space-y-3 mb-6">
              <div id="customer-action-extra-fields"></div>
              <textarea id="customer-action-note" rows="3" placeholder="Reason/Note" class="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm focus:outline-none focus:ring-1 focus:ring-primary"></textarea>
           </div>
           
           <div class="flex items-center justify-end gap-3">
              <button onclick="window.closeCustomerActionModal()" class="px-4 py-2 font-semibold text-sm hover:bg-surface-hover rounded-lg transition-colors">Cancel</button>
              <button id="customer-action-submit" onclick="window.submitCustomerAction()" class="px-4 py-2 rounded-lg bg-primary text-white font-semibold flex items-center justify-center min-w-[100px] transition-colors">Confirm</button>
           </div>
        </div>
      </div>
    </div>
  `;
}
