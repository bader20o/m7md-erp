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
      tbody.innerHTML = TableRowSkeleton(9).repeat(5); // Increased skeleton columns 

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
          tbody.innerHTML = `<tr><td colspan="9" class="py-12 text-center text-muted text-sm">No customers found.</td></tr>`;
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
              <td class="px-4 py-3 text-sm whitespace-nowrap">${formatDate(item.joinedAt)}</td>
              <td class="px-4 py-3">${statusBadge(item.status)}</td>
              <td class="px-4 py-3 text-sm font-semibold text-text">${formatMoney(item.totalPaid)}</td>
              <td class="px-4 py-3 text-sm font-semibold text-text">${formatMoney(item.totalServicesCost)}</td>
              <td class="px-4 py-3 text-sm text-center">
                <span class="px-2 py-0.5 rounded bg-bg border border-border text-xs font-semibold">
                  ${item.completedJobs} / ${item.totalBookings}
                </span>
              </td>
              <td class="px-4 py-3 text-sm whitespace-nowrap">${formatDate(item.lastActivityDate)}</td>
              <td class="px-4 py-3 text-sm font-bold ${Number(item.balanceDue) <= 0 ? "text-success" :
                  Number(item.balanceDue) <= 100 ? "text-amber-500" : "text-danger"
                }">${formatMoney(item.balanceDue)}</td>
              <td class="px-4 py-3 text-right text-sm text-primary font-semibold">View</td>
            </tr>
          `
            )
            .join("");
        }
      } catch (error) {
        tbody.innerHTML = `<tr><td colspan="9" class="py-12 text-center text-danger text-sm">${error.message}</td></tr>`;
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

        const bookingsRows = customer.customerBookings || [];
        const bookingsHtml =
          bookingsRows.length > 0
            ? bookingsRows
              .map(
                (b) => `
              <tr class="border-b border-border">
                <td class="px-3 py-2 text-xs">
                  <div class="font-semibold">${b.serviceNameSnapshotEn}</div>
                </td>
                <td class="px-3 py-2 text-xs">${statusBadge(b.status.toLowerCase())}</td>
                <td class="px-3 py-2 text-xs whitespace-nowrap">${formatDate(b.appointmentAt)}</td>
                <td class="px-3 py-2 text-xs font-semibold">${formatMoney(b.finalPrice)}</td>
              </tr>
            `
              )
              .join("")
            : `<tr><td colspan="4" class="px-3 py-6 text-center text-xs text-muted">No bookings found.</td></tr>`;

        content.innerHTML = `
          <div class="flex items-center gap-3 mb-5">
            ${avatarFor(customer.fullName, customer.avatarUrl)}
            <div>
              <div class="text-base font-bold">${customer.fullName || "Unnamed"}</div>
              <div class="text-xs text-muted">${customer.phone}</div>
            </div>
          </div>

          <!-- Tabs Header -->
          <div class="flex items-center gap-4 border-b border-border mb-5">
            <button id="customer-tab-btn-overview" onclick="window.switchCustomerTab('overview')" class="customer-tab-btn pb-2 text-sm font-semibold border-b-2 transition-colors border-primary text-primary">Overview</button>
            <button id="customer-tab-btn-ledger" onclick="window.switchCustomerTab('ledger')" class="customer-tab-btn pb-2 text-sm font-semibold border-b-2 border-transparent text-muted hover:text-text transition-colors">Ledger</button>
            <button id="customer-tab-btn-bookings" onclick="window.switchCustomerTab('bookings')" class="customer-tab-btn pb-2 text-sm font-semibold border-b-2 border-transparent text-muted hover:text-text transition-colors">Bookings</button>
          </div>

          <!-- Tab: Overview -->
          <div id="customer-tab-overview" class="customer-tab-content space-y-5 animate-in fade-in">
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

            <h4 class="text-sm font-bold mt-2">Account Actions</h4>
            <div class="grid grid-cols-2 gap-2">
              <button class="px-3 py-2 rounded-lg border border-border text-sm hover:border-primary" onclick="window.customerAction('${id}','suspend')">Suspend</button>
              <button class="px-3 py-2 rounded-lg border border-border text-sm hover:border-primary" onclick="window.customerAction('${id}','ban')">Ban</button>
              <button class="px-3 py-2 rounded-lg border border-border text-sm hover:border-primary" onclick="window.customerAction('${id}','reset_password')">Reset Password</button>
              <button class="px-3 py-2 rounded-lg border border-border text-sm hover:border-primary" onclick="window.customerAction('${id}','activate')">Activate</button>
            </div>
            
            <h4 class="text-sm font-bold mt-4">Ledger Actions</h4>
            <div class="grid grid-cols-3 gap-2">
              <button class="px-3 py-2 rounded-lg bg-danger/10 text-danger text-xs font-semibold hover:bg-danger hover:text-white transition-colors" onclick="window.customerLedgerAction('${id}','CHARGE')">Add Debt</button>
              <button class="px-3 py-2 rounded-lg bg-success/10 text-success text-xs font-semibold hover:bg-success hover:text-white transition-colors" onclick="window.customerLedgerAction('${id}','PAYMENT')">Record Payment</button>
              <button class="px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary hover:text-white transition-colors" onclick="window.customerLedgerAction('${id}','ADJUSTMENT')">Adjust</button>
            </div>
          </div>

          <!-- Tab: Ledger -->
          <div id="customer-tab-ledger" class="customer-tab-content hidden animate-in fade-in">
            <div class="max-h-[400px] overflow-auto border border-border rounded-lg">
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

          <!-- Tab: Bookings -->
          <div id="customer-tab-bookings" class="customer-tab-content hidden animate-in fade-in">
            <div class="max-h-[400px] overflow-auto border border-border rounded-lg">
              <table class="w-full text-left">
                <thead class="sticky top-0 bg-bg border-b border-border">
                  <tr>
                    <th class="px-3 py-2 text-[10px] uppercase text-muted">Service</th>
                    <th class="px-3 py-2 text-[10px] uppercase text-muted">Status</th>
                    <th class="px-3 py-2 text-[10px] uppercase text-muted">Date</th>
                    <th class="px-3 py-2 text-[10px] uppercase text-muted">Price</th>
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
        el.classList.remove('border-primary', 'text-primary');
        el.classList.add('border-transparent', 'text-muted');
      });
      document.getElementById(`customer-tab-${tabId}`).classList.remove('hidden');
      const activeBtn = document.getElementById(`customer-tab-btn-${tabId}`);
      if (activeBtn) {
        activeBtn.classList.remove('border-transparent', 'text-muted');
        activeBtn.classList.add('border-primary', 'text-primary');
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
    });

    createForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.target;
      if (state.duplicateBlocked) {
        window.toast("Duplicate phone detected.", "error");
        return;
      }
      if (!LOCAL_PHONE_REGEX.test(form.phone.value.trim())) {
        window.toast("Phone must start with 07 and contain 10 digits.", "error");
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
        window.closeCustomerCreateModal();
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

    if (window.location.hash === '#create-customer') {
      createContainer.classList.remove('hidden');
      createContainer.classList.add('flex');
    }

    window.closeCustomerCreateModal = () => {
      createContainer.classList.add("hidden");
      createContainer.classList.remove("flex");
      createForm.reset();
      duplicateWarning.classList.add("hidden");
      state.duplicateBlocked = false;
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
          <button onclick="window.closeCustomerCreateModal()" class="absolute top-4 right-4 w-8 h-8 rounded-full border border-border hover:bg-bg flex items-center justify-center text-muted hover:text-text transition-colors">×</button>
          <h3 class="text-xl font-bold mb-4">Create Customer</h3>
          <form id="customer-create-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input name="fullName" required placeholder="Full Name" class="px-3 py-2 rounded-lg border border-border bg-bg">
            <input id="customer-create-phone" name="phone" required maxlength="10" pattern="07[0-9]{8}" placeholder="07XXXXXXXX" class="px-3 py-2 rounded-lg border border-border bg-bg">
            <input name="password" placeholder="Password (optional)" class="px-3 py-2 rounded-lg border border-border bg-bg">
            <input name="location" placeholder="Location" class="px-3 py-2 rounded-lg border border-border bg-bg">
            <input name="initialDebt" type="number" step="0.01" placeholder="Initial Debt" class="px-3 py-2 rounded-lg border border-border bg-bg">
            <input name="initialPayment" type="number" step="0.01" placeholder="Initial Payment" class="px-3 py-2 rounded-lg border border-border bg-bg">
            <input name="initialDebtNote" placeholder="Initial Debt Note" class="md:col-span-2 px-3 py-2 rounded-lg border border-border bg-bg">
            <div id="customer-duplicate-warning" class="hidden md:col-span-2 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2"></div>
            <div class="md:col-span-2 flex justify-end gap-3 mt-2">
               <button type="button" onclick="window.closeCustomerCreateModal()" class="px-4 py-2 font-semibold text-sm hover:bg-surface-hover rounded-lg transition-colors">Cancel</button>
               <button class="px-6 py-2 rounded-lg bg-primary text-white font-semibold">Save</button>
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
                <th class="px-4 py-3 text-xs uppercase text-muted">Customer</th>
                <th class="px-4 py-3 text-xs uppercase text-muted">Phone</th>
                <th class="px-4 py-3 text-xs uppercase text-muted">Joined</th>
                <th class="px-4 py-3 text-xs uppercase text-muted">Status</th>
                <th class="px-4 py-3 text-xs uppercase text-muted">Total Paid</th>
                <th class="px-4 py-3 text-xs uppercase text-muted">Services Cost</th>
                <th class="px-4 py-3 text-xs uppercase text-muted text-center">Jobs</th>
                <th class="px-4 py-3 text-xs uppercase text-muted">Last Activity</th>
                <th class="px-4 py-3 text-xs uppercase text-muted">Debt</th>
                <th class="px-4 py-3 text-xs uppercase text-muted text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="customers-tbody"></tbody>
          </table>
        </div>
      </div>

      <div id="customers-pagination" class="flex items-center justify-between"></div>

      <div id="customer-details-drawer" class="fixed inset-0 z-[70] hidden items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto pt-10 pb-10">
        <div class="bg-surface border border-border rounded-xl p-6 w-full max-w-2xl shadow-2xl relative animate-in zoom-in-95 my-auto">
          <button id="close-customer-drawer" class="absolute top-4 right-4 w-8 h-8 rounded-full border border-border hover:bg-bg flex items-center justify-center text-muted hover:text-text transition-colors">×</button>
          <h3 id="customer-drawer-title" class="text-xl font-bold mb-4">Customer</h3>
          <div id="customer-details-content" class="relative z-0"></div>
        </div>
      </div>

      <!-- Customer Action Modal -->
      <div id="customer-action-modal" class="fixed inset-0 z-[100] hidden items-center justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-surface border border-border rounded-xl p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95">
           <button onclick="window.closeCustomerActionModal()" class="absolute top-4 right-4 w-8 h-8 rounded-full border border-border hover:bg-bg flex items-center justify-center text-muted hover:text-text transition-colors">×</button>
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
