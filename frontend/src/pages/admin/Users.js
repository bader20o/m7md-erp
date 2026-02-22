import { apiFetch } from '../../lib/api.js';
import { TableRowSkeleton } from '../../components/ui/Skeleton.js';

export function AdminUsers() {
    window.onMount = async () => {
        const tbody = document.getElementById('users-tbody');
        try {
            tbody.innerHTML = TableRowSkeleton(5).repeat(5);
            const res = await apiFetch('/users'); // Fetch users list
            if (res && res.items) {
                if (res.items.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-muted font-medium text-sm">No users found</td></tr>`;
                } else {
                    tbody.innerHTML = res.items.map(u => `
                        <tr class="group border-b border-border bg-surface hover:bg-bg transition-colors">
                            <td class="px-6 py-4 whitespace-nowrap"><div class="text-sm font-bold text-text">${u.fullName || 'Unknown'}</div><div class="text-xs text-muted">${u.phone || '--'}</div></td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-text">${u.email || '--'}</td>
                            <td class="px-6 py-4 whitespace-nowrap"><span class="px-2.5 py-1 bg-primary/15 text-primary rounded-md text-[10px] font-bold uppercase tracking-wider">${u.role}</span></td>
                            <td class="px-6 py-4 whitespace-nowrap text-xs text-muted">${new Date(u.createdAt).toLocaleDateString()}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-right text-sm pr-6"><button class="text-primary hover:text-primary-hover font-semibold p-2">Edit</button></td>
                        </tr>
                    `).join('');
                }
            } else {
                tbody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-muted font-medium text-sm">No users found, or endpoint is not available.</td></tr>`;
            }
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-danger font-medium text-sm">Error loading users: ${e.message}</td></tr>`;
        }
    };

    return `
    <div class="w-full h-full flex flex-col gap-6 fade-in">
      <div class="flex justify-between items-center bg-surface border border-border p-4 rounded-xl">
        <div>
          <h1 class="text-2xl font-heading font-bold text-text">User Management</h1>
        </div>
        <button class="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-sm flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
          Add User
        </button>
      </div>

      <div class="bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
        <div class="overflow-x-auto overflow-y-auto block h-full flex-1">
          <table class="w-full text-left min-w-[800px]">
            <thead class="bg-bg border-b border-border sticky top-0 z-10 w-full">
              <tr>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">User</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Email</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Role</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Joined</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody id="users-tbody" class="divide-y divide-border">
            </tbody>
          </table>
        </div>
      </div>
    </div>
    `;
}
