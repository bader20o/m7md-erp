// A simple, dependency-free chart wrapper simulation for the required charts (Line, Bar, Donut)
// In a real app, you would bridge to Chart.js or Recharts here.
// For this Antigravity vanilla implementation, we'll build simple SVG/HTML visual representations since "No heavy frameworks beyond Antigravity" is requested.

export function SimpleBarChart(data, options = {}) {
    // data: [{ label: 'Jan', value: 100 }, ...]
    const max = Math.max(...data.map(d => d.value), 1);
    const { height = '200px', color = 'var(--primary)', format = val => val } = options;

    const bars = data.map(item => {
        const pct = (item.value / max) * 100;
        return `
      <div class="flex flex-col items-center gap-2 group flex-1">
        <div class="relative w-full h-full flex items-end justify-center rounded-t-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
           <div class="absolute -top-8 bg-surface text-text text-xs py-1 px-2 rounded border border-border shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
             ${format(item.value)}
           </div>
           <div class="w-full max-w-[40px] rounded-t-sm transition-all duration-500 ease-out" 
                style="height: ${pct}%; background-color: ${color};"></div>
        </div>
        <span class="text-xs text-muted truncate w-full text-center" title="${item.label}">${item.label}</span>
      </div>
    `;
    }).join('');

    return `
    <div class="flex items-end w-full gap-1 sm:gap-2 px-2" style="height: ${height}">
      ${bars}
    </div>
  `;
}

export function SimpleDonutChart(data) {
    // data: [{ label: 'A', value: 10, color: '#f00' }, ...]
    // Very simplistic representation utilizing conic-gradient
    const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
    let currentStart = 0;

    const gradients = data.map(item => {
        const pct = (item.value / total) * 100;
        const start = currentStart;
        const end = currentStart + pct;
        currentStart = end;
        return `${item.color || 'var(--primary)'} ${start}% ${end}%`;
    }).join(', ');

    const legend = data.map(item => `
    <div class="flex items-center gap-2 text-sm text-text">
      <span class="w-3 h-3 rounded-full" style="background-color: ${item.color || 'var(--primary)'}"></span>
      <span>${item.label}</span>
      <span class="text-muted ml-auto font-medium">${((item.value / total) * 100).toFixed(0)}%</span>
    </div>
  `).join('');

    return `
    <div class="flex flex-col md:flex-row items-center gap-8 justify-center h-full">
      <div class="relative w-48 h-48 rounded-full" style="background: conic-gradient(${gradients})">
        <!-- Inner cutout for donut -->
        <div class="absolute inset-[20%] rounded-full bg-surface flex items-center justify-center m-auto shadow-inner">
          <span class="font-heading font-semibold text-lg text-text border-b border-border pb-1">Total: ${total}</span>
        </div>
      </div>
      <div class="flex flex-col gap-3 min-w-[150px]">
        ${legend}
      </div>
    </div>
  `;
}
