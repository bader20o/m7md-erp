import { apiFetch, buildQuery } from "../../lib/api.js";
import { TableRowSkeleton } from "../../components/ui/Skeleton.js";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function formatMoney(value) {
  const number = Number(value || 0);
  return `${number.toFixed(2)} JOD`;
}

function statusBadge(status) {
  if (status === "banned") return `<span class="px-2.5 py-1 bg-danger/15 text-danger rounded-md text-[10px] font-bold uppercase tracking-wider">Banned</span>`;
  if (status === "suspended") return `<span class="px-2.5 py-1 bg-amber-500/15 text-amber-500 rounded-md text-[10px] font-bold uppercase tracking-wider">Suspended</span>`;
  return `<span class="px-2.5 py-1 bg-success/15 text-success rounded-md text-[10px] font-bold uppercase tracking-wider">Active</span>`;
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

    const state = {
      q: "",
      status: "",
      joinFrom: "",
      joinTo: "",
      page: 1,
      limit: 10,
      total: 0,
      loading: false,
      duplicateBlocked: false
    };

    let searchDebounce = null;
    let duplicateDebounce = null;

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
      tbody.innerHTML = TableRowSkeleton(6).repeat(5);

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
          tbody.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-muted text-sm">No customers found.</td></tr>`;
        } else {
          tbody.innerHTML = items
            .map(
              (item) => `
            <tr class="border-b border-border hover:bg-bg cursor-pointer transition-colors" onclick="window.openCustomerDetails('${item.id}')">
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  ${avatarFor(item.fullName, item.avatar)}
                  <div>
                    <div class="text-sm font-semibold text-text">${item.fullName || "Unnamed Customer"}</div>
                    <div class="text-xs text-muted">${item.phone}</div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 text-sm">${item.phone}</td>
              <td class="px-4 py-3 text-sm">${formatDate(item.joinedAt)}</td>
              <td class="px-4 py-3">${statusBadge(item.status)}</td>
              <td class="px-4 py-3 text-sm font-semibold ${Number(item.balanceDue) > 0 ? "text-danger" : "text-success"}">${formatMoney(item.balanceDue)}</td>
              <td class="px-4 py-3 text-right text-sm text-primary font-semibold">View</td>
            </tr>
          `
            )
            .join("");
        }
      } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-danger text-sm">${error.message}</td></tr>`;
      } finally {
        state.loading = false;
        renderPagination();
      }
    }

    async function loadCustomerDetails(id) {
      const drawer = document.getElementById("customer-details-drawer");
      const content = document.getElementById("customer-details-content");
      const title = document.getElementById("customer-drawer-title");
      drawer.classList.remove("translate-x-full");
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
              <tr class="border-b border-border">
                <td class="px-3 py-2 text-xs">${entry.type}</td>
                <td class="px-3 py-2 text-xs font-semibold ${entry.type === "PAYMENT" ? "text-success" : "text-danger"}">${formatMoney(entry.amount)}</td>
                <td class="px-3 py-2 text-xs">${formatDate(entry.occurredAt)}</td>
                <td class="px-3 py-2 text-xs">${entry.note || "-"}</td>
              </tr>
            `
                )
                .join("")
            : `<tr><td colspan="4" class="px-3 py-6 text-center text-xs text-muted">No ledger entries.</td></tr>`;

        content.innerHTML = `
          <div class="space-y-5">
            <div class="flex items-center gap-3">
              ${avatarFor(customer.fullName, customer.avatarUrl)}
              <div>
                <div class="text-base font-bold">${customer.fullName || "Unnamed"}</div>
                <div class="text-xs text-muted">${customer.phone}</div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3 text-xs">
              <div class="rounded-lg border border-border p-3">
                <div class="text-muted uppercase">Joined</div>
                <div class="font-semibold mt-1">${formatDate(customer.joinedAt)}</div>
              </div>
              <div class="rounded-lg border border-border p-3">
                <div class="text-muted uppercase">Status</div>
                <div class="mt-1">${statusBadge(customer.status)}</div>
              </div>
              <div class="rounded-lg border border-border p-3 col-span-2">
                <div class="text-muted uppercase">Current Debt</div>
                <div class="font-bold text-lg mt-1 ${Number(customer.balanceDue) > 0 ? "text-danger" : "text-success"}">${formatMoney(customer.balanceDue)}</div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button class="px-3 py-2 rounded-lg border border-border text-sm hover:border-primary" onclick="window.customerAction('${id}','suspend')">Suspend</button>
              <button class="px-3 py-2 rounded-lg border border-border text-sm hover:border-primary" onclick="window.customerAction('${id}','ban')">Ban</button>
              <button class="px-3 py-2 rounded-lg border border-border text-sm hover:border-primary" onclick="window.customerAction('${id}','reset_password')">Reset Password</button>
              <button class="px-3 py-2 rounded-lg border border-border text-sm hover:border-primary" onclick="window.customerAction('${id}','activate')">Activate</button>
            </div>

            <div class="grid grid-cols-3 gap-2">
              <button class="px-3 py-2 rounded-lg bg-danger/10 text-danger text-xs font-semibold hover:bg-danger hover:text-white" onclick="window.customerLedgerAction('${id}','CHARGE')">Add Debt</button>
              <button class="px-3 py-2 rounded-lg bg-success/10 text-success text-xs font-semibold hover:bg-success hover:text-white" onclick="window.customerLedgerAction('${id}','PAYMENT')">Record Payment</button>
              <button class="px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary hover:text-white" onclick="window.customerLedgerAction('${id}','ADJUSTMENT')">Adjust</button>
            </div>

            <div>
              <h4 class="text-sm font-bold mb-2">Ledger</h4>
              <div class="max-h-64 overflow-auto border border-border rounded-lg">
                <table class="w-full text-left">
                  <thead class="sticky top-0 bg-bg border-b border-border">
                    <tr>
                      <th class="px-3 py-2 text-[10px] uppercase text-muted">Type</th>
                      <th class="px-3 py-2 text-[10px] uppercase text-muted">Amount</th>
                      <th class="px-3 py-2 text-[10px] uppercase text-muted">Date</th>
                      <th class="px-3 py-2 text-[10px] uppercase text-muted">Note</th>
                    </tr>
                  </thead>
                  <tbody>${ledgerHtml}</tbody>
                </table>
              </div>
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

    window.customerAction = async (id, action) => {
      try {
        if (action === "suspend") {
          const reason = prompt("Suspension reason (optional):") || undefined;
          await apiFetch(`/admin/customers/${id}`, { method: "PATCH", body: { action, reason } });
        } else if (action === "ban") {
          const durationInput = prompt("Ban duration in days (leave empty for permanent):");
          const message = prompt("Ban message shown to user (optional):") || undefined;
          const banReason = prompt("Internal ban reason (optional):") || undefined;
          await apiFetch(`/admin/customers/${id}`, {
            method: "PATCH",
            body: {
              action,
              durationDays: durationInput ? Number(durationInput) : undefined,
              banMessage: message,
              banReason
            }
          });
        } else if (action === "reset_password") {
          const result = await apiFetch(`/admin/users/${id}/password-reset`, {
            method: "POST",
            body: { forceOnly: false }
          });
          if (result.temporaryPassword) {
            alert(`Temporary password: ${result.temporaryPassword}`);
          }
        } else {
          await apiFetch(`/admin/customers/${id}`, { method: "PATCH", body: { action } });
        }
        window.toast("Customer updated", "success");
        await loadCustomers();
        await loadCustomerDetails(id);
      } catch (error) {
        window.toast(error.message, "error");
      }
    };

    window.customerLedgerAction = async (id, type) => {
      try {
        const amountInput = prompt(type === "ADJUSTMENT" ? "Adjustment amount (negative or positive):" : "Amount:");
        if (!amountInput) return;
        const note = prompt("Note:") || undefined;
        if ((type === "CHARGE" || type === "ADJUSTMENT") && !note) {
          window.toast("Note is required for this entry type.", "error");
          return;
        }
        await apiFetch(`/admin/customers/${id}/ledger`, {
          method: "POST",
          body: {
            type,
            amount: Number(amountInput),
            note
          }
        });
        window.toast("Ledger updated", "success");
        await loadCustomers();
        await loadCustomerDetails(id);
      } catch (error) {
        window.toast(error.message, "error");
      }
    };

    document.getElementById("close-customer-drawer").addEventListener("click", () => {
      document.getElementById("customer-details-drawer").classList.add("translate-x-full");
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
      createContainer.classList.toggle("hidden");
    });

    createForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.target;
      if (state.duplicateBlocked) {
        window.toast("Duplicate phone detected.", "error");
        return;
      }
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
        createContainer.classList.add("hidden");
        window.toast("Customer created", "success");
        loadCustomers();
      } catch (error) {
        window.toast(error.message, "error");
      }
    });

    customerPhoneInput.addEventListener("input", () => {
      clearTimeout(duplicateDebounce);
      duplicateDebounce = setTimeout(checkCustomerPhoneDuplicate, 250);
    });

    loadCustomers();
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

      <div id="customer-create-container" class="hidden bg-surface border border-border rounded-xl p-4">
        <form id="customer-create-form" class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input name="fullName" required placeholder="Full Name" class="px-3 py-2 rounded-lg border border-border bg-bg">
          <input id="customer-create-phone" name="phone" required placeholder="Phone" class="px-3 py-2 rounded-lg border border-border bg-bg">
          <input name="password" placeholder="Password (optional)" class="px-3 py-2 rounded-lg border border-border bg-bg">
          <input name="location" placeholder="Location" class="px-3 py-2 rounded-lg border border-border bg-bg">
          <input name="initialDebt" type="number" step="0.01" placeholder="Initial Debt" class="px-3 py-2 rounded-lg border border-border bg-bg">
          <input name="initialPayment" type="number" step="0.01" placeholder="Initial Payment" class="px-3 py-2 rounded-lg border border-border bg-bg">
          <input name="initialDebtNote" placeholder="Initial Debt Note" class="md:col-span-2 px-3 py-2 rounded-lg border border-border bg-bg">
          <div id="customer-duplicate-warning" class="hidden md:col-span-3 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2"></div>
          <button class="px-4 py-2 rounded-lg bg-primary text-white font-semibold">Save</button>
        </form>
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
          <input id="customers-join-from" type="date" class="px-3 py-2 rounded-lg border border-border bg-surface">
          <input id="customers-join-to" type="date" class="px-3 py-2 rounded-lg border border-border bg-surface">
        </div>
      </div>

      <div class="bg-surface border border-border rounded-xl overflow-hidden">
        <div class="overflow-auto">
          <table class="w-full min-w-[900px] text-left">
            <thead class="bg-bg border-b border-border">
              <tr>
                <th class="px-4 py-3 text-xs uppercase text-muted">Customer</th>
                <th class="px-4 py-3 text-xs uppercase text-muted">Phone</th>
                <th class="px-4 py-3 text-xs uppercase text-muted">Joined</th>
                <th class="px-4 py-3 text-xs uppercase text-muted">Status</th>
                <th class="px-4 py-3 text-xs uppercase text-muted">Debt</th>
                <th class="px-4 py-3 text-xs uppercase text-muted text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="customers-tbody"></tbody>
          </table>
        </div>
      </div>

      <div id="customers-pagination" class="flex items-center justify-between"></div>

      <aside id="customer-details-drawer" class="fixed top-0 right-0 h-full w-full max-w-lg bg-surface border-l border-border z-[70] p-5 overflow-y-auto transform translate-x-full transition-transform duration-300">
        <div class="flex items-center justify-between mb-4">
          <h3 id="customer-drawer-title" class="text-lg font-bold">Customer</h3>
          <button id="close-customer-drawer" class="w-8 h-8 rounded-full border border-border hover:border-primary">×</button>
        </div>
        <div id="customer-details-content"></div>
      </aside>
    </div>
  `;
}
