/**
 * Skeletons meant to replace spinners.
 */

export function CardSkeleton() {
    return `
    <div class="bg-surface rounded-2xl p-5 border border-border flex flex-col gap-4">
      <div class="skeleton h-5 w-1/3"></div>
      <div class="skeleton h-4 w-1/2"></div>
      <div class="mt-4 flex justify-between items-center">
        <div class="skeleton h-6 w-20"></div>
        <div class="skeleton h-8 w-24 rounded-lg"></div>
      </div>
    </div>
  `;
}

export function TableRowSkeleton(cols = 4) {
    return `
    <tr class="border-b border-border">
      ${Array.from({ length: cols }).map(() => `
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="skeleton h-4 w-full max-w-[120px]"></div>
        </td>
      `).join('')}
    </tr>
  `;
}

export function KPISkeleton() {
    return `
    <div class="bg-surface rounded-xl p-6 border border-border relative overflow-hidden">
      <div class="skeleton h-4 w-24 mb-2"></div>
      <div class="skeleton h-8 w-32"></div>
      <div class="absolute bottom-6 right-6 skeleton h-10 w-10 rounded-full"></div>
    </div>
  `;
}

export function ChartSkeleton() {
    return `
    <div class="bg-surface rounded-xl p-6 border border-border h-[300px] flex items-end gap-2 justify-between">
      ${Array.from({ length: 12 }).map(() => `
        <div class="skeleton w-8 rounded-t-sm" style="height: ${Math.max(20, Math.random() * 100)}%"></div>
      `).join('')}
    </div>
  `;
}
