export function ForbiddenPage() {
  return `
    <div class="max-w-3xl mx-auto w-full py-10">
      <div class="bg-surface border border-border rounded-2xl p-8 text-center">
        <div class="mx-auto w-14 h-14 rounded-full bg-danger/10 text-danger flex items-center justify-center mb-4">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z"></path></svg>
        </div>
        <h1 class="text-2xl font-heading font-bold text-text">403 - Access Denied</h1>
        <p class="text-muted mt-3">You do not have permission to access this section.</p>
        <button onclick="navigate(event, '/admin/profile')" class="mt-6 px-5 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition-colors">Go to My Profile</button>
      </div>
    </div>
  `;
}
