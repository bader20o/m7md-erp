import { apiFetch, buildQuery } from "../../lib/api.js";

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function relativeInputValue(daysBack) {
  const value = new Date();
  value.setDate(value.getDate() - daysBack);
  return value.toISOString().slice(0, 10);
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "-";
}

function formatSecondsRemaining(expiresAt) {
  if (!expiresAt) return "Refreshing...";
  const diffSeconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
  return `${diffSeconds}s`;
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes == null) return "-";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder}m`;
}

function badge(label, tone) {
  return `<span class="inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide ${tone}">${esc(label)}</span>`;
}

function resultBadge(value) {
  return value === "ACCEPTED"
    ? badge(value, "border-emerald-500/30 bg-emerald-500/10 text-emerald-400")
    : badge(value, "border-danger/30 bg-danger/10 text-danger");
}

function typeBadge(value) {
  return value === "CHECK_OUT"
    ? badge("OUT", "border-amber-500/30 bg-amber-500/10 text-amber-400")
    : badge("IN", "border-sky-500/30 bg-sky-500/10 text-sky-300");
}

function summaryCard(label, value, tone = "text-text") {
  return `
    <div class="rounded-[24px] border border-border bg-surface px-5 py-5">
      <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">${label}</div>
      <div class="mt-3 text-3xl font-bold ${tone}">${esc(String(value ?? 0))}</div>
    </div>
  `;
}

export function AdminAttendance() {
  window.onMount = async () => {
    const summaryGrid = document.getElementById("attendance-summary-grid");
    const qrGrid = document.getElementById("attendance-fixed-qr");
    const tableBody = document.getElementById("attendance-events-body");
    const pagination = document.getElementById("attendance-pagination");
    const drawer = document.getElementById("attendance-employee-drawer");
    const drawerContent = document.getElementById("attendance-employee-content");
    const filterForm = document.getElementById("attendance-filter-form");

    const state = {
      from: relativeInputValue(13),
      to: todayInputValue(),
      employeeQuery: "",
      status: "",
      page: 1,
      pageSize: 20,
      total: 0,
      qrRefreshTimer: null,
      qrCountdownTimer: null,
      qrData: null
    };

    const renderDrawerDays = (days) => {
      if (!days.length) {
        return `<div class="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">No attendance records found for this employee in the selected range.</div>`;
      }

      return days
        .map(
          (day) => `
            <div class="rounded-[24px] border border-border bg-bg px-5 py-5">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">${esc(day.dayKey)}</div>
                  <div class="mt-2 flex flex-wrap gap-2">
                    ${day.flags?.length ? day.flags.map((flag) => badge(flag, "border-amber-500/30 bg-amber-500/10 text-amber-400")).join("") : badge(day.status || "OPEN", "border-border bg-surface text-text")}
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-xs text-muted">Worked</div>
                  <div class="mt-1 text-lg font-semibold text-text">${esc(formatDuration(day.workedMinutes))}</div>
                </div>
              </div>
              <div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div class="rounded-2xl border border-border bg-surface px-4 py-4">
                  <div class="text-[11px] uppercase tracking-[0.16em] text-muted">Check In</div>
                  <div class="mt-2 text-lg font-semibold text-emerald-400">${esc(day.checkInAt ? formatDateTime(day.checkInAt) : "Not recorded")}</div>
                </div>
                <div class="rounded-2xl border border-border bg-surface px-4 py-4">
                  <div class="text-[11px] uppercase tracking-[0.16em] text-muted">Check Out</div>
                  <div class="mt-2 text-lg font-semibold text-amber-400">${esc(day.checkOutAt ? formatDateTime(day.checkOutAt) : "Not recorded")}</div>
                </div>
                <div class="rounded-2xl border border-border bg-surface px-4 py-4">
                  <div class="text-[11px] uppercase tracking-[0.16em] text-muted">Invalid Attempts</div>
                  <div class="mt-2 text-lg font-semibold text-danger">${esc(String(day.invalidAttempts || 0))}</div>
                </div>
              </div>
              ${
                day.rejectedReasons?.length
                  ? `<div class="mt-4 text-sm text-muted">Reject reasons: ${esc(day.rejectedReasons.join(", "))}</div>`
                  : ""
              }
            </div>
          `
        )
        .join("");
    };

    async function openEmployeeDrawer(employeeId) {
      drawer.classList.remove("hidden");
      drawer.classList.add("flex");
      drawerContent.innerHTML = `<div class="py-12 text-center text-sm text-muted">Loading employee attendance...</div>`;

      try {
        const response = await apiFetch(
          `/admin/attendance/employee/${employeeId}${buildQuery({ from: state.from, to: state.to })}`
        );
        drawerContent.innerHTML = `
          <div class="space-y-5">
            <div class="rounded-[24px] border border-border bg-bg px-5 py-5">
              <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Employee</div>
              <div class="mt-2 text-2xl font-bold text-text">${esc(response.employee.fullName)}</div>
              <div class="mt-1 text-sm text-muted">${esc(response.employee.phone)}</div>
            </div>
            ${renderDrawerDays(response.days || [])}
          </div>
        `;
      } catch (error) {
        drawerContent.innerHTML = `<div class="py-12 text-center text-sm text-danger">${esc(error.message)}</div>`;
      }
    }

    function closeEmployeeDrawer() {
      drawer.classList.add("hidden");
      drawer.classList.remove("flex");
      drawerContent.innerHTML = "";
    }

    function renderPagination() {
      const pageCount = Math.max(1, Math.ceil(state.total / state.pageSize));
      pagination.innerHTML = `
        <div class="text-sm text-muted">Page ${state.page} of ${pageCount} (${state.total} logs)</div>
        <div class="flex items-center gap-2">
          <button id="attendance-prev" type="button" class="rounded-xl border border-border px-4 py-2 text-sm ${state.page <= 1 ? "pointer-events-none opacity-50" : "text-text"}">Prev</button>
          <button id="attendance-next" type="button" class="rounded-xl border border-border px-4 py-2 text-sm ${state.page >= pageCount ? "pointer-events-none opacity-50" : "text-text"}">Next</button>
        </div>
      `;

      pagination.querySelector("#attendance-prev").addEventListener("click", () => {
        if (state.page <= 1) return;
        state.page -= 1;
        void loadAttendance();
      });
      pagination.querySelector("#attendance-next").addEventListener("click", () => {
        if (state.page >= pageCount) return;
        state.page += 1;
        void loadAttendance();
      });
    }

    function renderQrCards(qrData) {
      state.qrData = qrData;

      if (!qrData) {
        qrGrid.innerHTML = `<div class="rounded-[24px] border border-dashed border-border px-5 py-10 text-center text-sm text-muted lg:col-span-2">Fixed QR payloads are not available.</div>`;
        return;
      }

      const securityNote = qrData.ipRestricted
        ? "Scans are accepted only from the allowed service center network."
        : "Set ATTENDANCE_ALLOWED_IPS to lock scans to the center network.";

      qrGrid.innerHTML = [
        {
          title: "Check In QR",
          key: "checkIn",
          tone: "border-sky-500/20 bg-sky-500/5"
        },
        {
          title: "Check Out QR",
          key: "checkOut",
          tone: "border-amber-500/20 bg-amber-500/5"
        }
      ]
        .map(
          (item) => `
            <div class="rounded-[28px] border ${item.tone} px-6 py-6">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">${item.title}</div>
                  <p class="mt-2 text-sm text-muted">${securityNote}</p>
                  <p class="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Rotates every ${esc(String(qrData.refreshEverySeconds || 5))} seconds</p>
                </div>
                <div class="rounded-xl border border-border bg-bg px-4 py-2 text-right">
                  <div class="text-[10px] uppercase tracking-[0.16em] text-muted">Expires In</div>
                  <div data-qr-countdown="${item.key}" class="mt-1 text-sm font-semibold text-text">${esc(formatSecondsRemaining(qrData[item.key].expiresAt))}</div>
                </div>
              </div>
              <div class="mt-5 flex flex-col items-center gap-4 lg:flex-row lg:items-center">
                <img src="${qrData[item.key].imageDataUrl}" alt="${item.title}" class="h-48 w-48 rounded-2xl border border-border bg-white p-3" />
                <div class="w-full rounded-2xl border border-border bg-bg px-4 py-4 text-sm text-text">
                  <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Security</div>
                  <div class="mt-3 text-sm text-muted">This QR is live, short-lived, and invalid after the countdown ends. Use it only on the in-center attendance screen.</div>
                  <div class="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Screenshots and old photos will expire automatically.</div>
                </div>
              </div>
            </div>
          `
        )
        .join("");
    }

    function updateQrCountdowns() {
      if (!state.qrData) return;
      qrGrid.querySelectorAll("[data-qr-countdown]").forEach((node) => {
        const key = node.getAttribute("data-qr-countdown");
        if (!key || !state.qrData[key]) return;
        node.textContent = formatSecondsRemaining(state.qrData[key].expiresAt);
      });
    }

    async function loadQrCodes() {
      try {
        const response = await apiFetch("/admin/attendance/qr");
        renderQrCards(response);
      } catch (error) {
        qrGrid.innerHTML = `<div class="rounded-[24px] border border-dashed border-danger/20 bg-danger/5 px-5 py-10 text-center text-sm text-danger lg:col-span-2">${esc(error.message)}</div>`;
      }
    }

    function renderSummary(summary) {
      summaryGrid.innerHTML = [
        summaryCard("Checked In Today", summary?.checkedInCount || 0, "text-emerald-400"),
        summaryCard("Checked Out Today", summary?.checkedOutCount || 0, "text-amber-400"),
        summaryCard("Missing Check-Out", summary?.missingCheckOutCount || 0, "text-danger")
      ].join("");
    }

    function renderTable(events) {
      tableBody.innerHTML = events.length
        ? events
            .map(
              (event) => `
                <tr class="border-t border-border">
                  <td class="px-4 py-3 text-sm text-text">
                    <div class="font-semibold">${esc(event.employeeName)}</div>
                    <div class="text-xs text-muted">${esc(event.employeePhone)}</div>
                  </td>
                  <td class="px-4 py-3 text-sm">${typeBadge(event.type)}</td>
                  <td class="px-4 py-3 text-sm text-text">${esc(formatDateTime(event.timestamp))}</td>
                  <td class="px-4 py-3 text-sm">${resultBadge(event.result)}</td>
                  <td class="px-4 py-3 text-sm text-muted">${esc(event.source || "QR")}</td>
                  <td class="px-4 py-3 text-sm text-muted">${esc(event.message || "-")}</td>
                  <td class="px-4 py-3 text-sm">
                    <button type="button" data-open-employee="${event.employeeId}" class="font-semibold text-primary">View</button>
                  </td>
                </tr>
              `
            )
            .join("")
        : `<tr><td colspan="7" class="px-4 py-10 text-center text-sm text-muted">No attendance logs found for the selected filters.</td></tr>`;

      tableBody.querySelectorAll("[data-open-employee]").forEach((button) => {
        button.addEventListener("click", () => {
          void openEmployeeDrawer(button.dataset.openEmployee);
        });
      });
    }

    async function loadAttendance() {
      tableBody.innerHTML = `<tr><td colspan="7" class="px-4 py-10 text-center text-sm text-muted">Loading attendance logs...</td></tr>`;
      try {
        const response = await apiFetch(
          `/admin/attendance${buildQuery({
            from: state.from,
            to: state.to,
            employeeQuery: state.employeeQuery,
            status: state.status,
            page: state.page,
            pageSize: state.pageSize
          })}`
        );
        state.total = response.pagination?.total || 0;
        renderSummary(response.summary);
        renderTable(response.events || []);
        renderPagination();
      } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="7" class="px-4 py-10 text-center text-sm text-danger">${esc(error.message)}</td></tr>`;
      }
    }

    document.getElementById("attendance-close-drawer").addEventListener("click", closeEmployeeDrawer);
    drawer.addEventListener("click", (event) => {
      if (event.target === drawer) {
        closeEmployeeDrawer();
      }
    });
    filterForm.addEventListener("submit", (event) => {
      event.preventDefault();
      state.from = filterForm.from.value || relativeInputValue(13);
      state.to = filterForm.to.value || todayInputValue();
      state.employeeQuery = filterForm.employeeQuery.value.trim();
      state.status = filterForm.status.value;
      state.page = 1;
      void loadAttendance();
    });
    document.getElementById("attendance-reset-filters").addEventListener("click", () => {
      filterForm.reset();
      filterForm.from.value = relativeInputValue(13);
      filterForm.to.value = todayInputValue();
      state.from = filterForm.from.value;
      state.to = filterForm.to.value;
      state.employeeQuery = "";
      state.status = "";
      state.page = 1;
      void loadAttendance();
    });

    filterForm.from.value = state.from;
    filterForm.to.value = state.to;

    await loadQrCodes();
    state.qrCountdownTimer = window.setInterval(updateQrCountdowns, 1000);
    state.qrRefreshTimer = window.setInterval(() => {
      void loadQrCodes();
    }, 5000);

    window.__pageCleanup = () => {
      if (state.qrCountdownTimer) {
        window.clearInterval(state.qrCountdownTimer);
      }
      if (state.qrRefreshTimer) {
        window.clearInterval(state.qrRefreshTimer);
      }
    };

    await loadAttendance();
  };

  return `
    <div class="flex w-full flex-col gap-6">
      <div class="rounded-[28px] border border-border bg-surface px-6 py-6">
        <h1 class="text-3xl font-heading font-bold text-text">Attendance</h1>
        <p class="mt-2 text-sm text-muted">Global attendance logs, rotating QR codes, and per-employee day summaries.</p>
      </div>

      <div id="attendance-summary-grid" class="grid grid-cols-1 gap-4 md:grid-cols-3"></div>

      <div id="attendance-fixed-qr" class="grid grid-cols-1 gap-6 xl:grid-cols-2"></div>

      <form id="attendance-filter-form" class="grid grid-cols-1 gap-3 rounded-[28px] border border-border bg-surface px-6 py-6 lg:grid-cols-[1fr_180px_180px_180px_auto]">
        <input name="employeeQuery" placeholder="Search employee name or phone" class="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text" />
        <input name="from" type="date" class="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text" />
        <input name="to" type="date" class="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text" />
        <select name="status" class="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text">
          <option value="">All results</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <div class="flex gap-3">
          <button type="submit" class="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white">Apply</button>
          <button id="attendance-reset-filters" type="button" class="rounded-xl border border-border bg-bg px-5 py-3 text-sm font-semibold text-text">Reset</button>
        </div>
      </form>

      <div class="overflow-hidden rounded-[28px] border border-border bg-surface">
        <div class="border-b border-border px-6 py-5">
          <h2 class="text-xl font-bold text-text">Attendance Logs</h2>
          <p class="mt-1 text-sm text-muted">Append-only accepted and rejected scan attempts.</p>
        </div>
        <div class="overflow-auto">
          <table class="min-w-[1120px] w-full text-left">
            <thead class="bg-bg">
              <tr>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted">Employee</th>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted">Type</th>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted">Timestamp</th>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted">Result</th>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted">Source</th>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted">Message</th>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted">Action</th>
              </tr>
            </thead>
            <tbody id="attendance-events-body"></tbody>
          </table>
        </div>
      </div>

      <div id="attendance-pagination" class="flex items-center justify-between"></div>

      <div id="attendance-employee-drawer" class="fixed inset-0 z-[90] hidden items-stretch justify-end bg-black/50">
        <div class="h-full w-full max-w-2xl overflow-y-auto border-l border-border bg-surface px-6 py-6">
          <div class="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 class="text-2xl font-bold text-text">Employee Detail</h2>
              <p class="mt-1 text-sm text-muted">Grouped by day with worked duration and invalid attempt flags.</p>
            </div>
            <button id="attendance-close-drawer" type="button" class="rounded-xl border border-border bg-bg px-4 py-2 text-sm font-semibold text-text">Close</button>
          </div>
          <div id="attendance-employee-content"></div>
        </div>
      </div>
    </div>
  `;
}
