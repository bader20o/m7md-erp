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
      <div class="flex flex-col items-center group min-w-[32px] flex-1">
        <div class="relative w-full h-full flex items-end justify-center rounded-t-md hover:bg-white/5 transition-colors overflow-visible border-b border-white/10">
           <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface text-text text-[10px] font-bold py-1 px-2 rounded-lg border border-white/10 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
             ${format(item.value)}
           </div>
           <div class="w-full max-w-[32px] rounded-t-sm transition-all duration-500 ease-out" 
                style="height: ${pct}%; background-color: ${color};"></div>
        </div>
        <span class="text-[9px] font-bold text-muted uppercase tracking-wider truncate w-full text-center pt-2" title="${item.label}">${item.label}</span>
      </div>
    `;
  }).join('');

  return `
    <style>
      .saas-scrollbar::-webkit-scrollbar {
        height: 6px;
      }
      .saas-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
      .saas-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
      }
      .saas-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    </style>
    <div class="flex items-end w-full gap-2 px-2 overflow-x-auto overflow-y-hidden pt-6 pb-2 shrink-0 relative saas-scrollbar" style="height: ${height}">
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

export function MultiBarChart(data, options = {}) {
  // data: [{ label: '01-Jan', income: 1000, expenses: 500, profit: 500 }, ...]
  const maxVal = Math.max(...data.flatMap(d => [d.income, d.expenses]), 1);
  const { height = '250px', format = val => val } = options;

  // Force all bars to render, no downsampling
  let visibleData = data;

  const bars = visibleData.map(item => {
    const incomePct = Math.max((item.income / maxVal) * 100, 1);
    const expensesPct = Math.max((item.expenses / maxVal) * 100, 1);

    return `
      <div class="flex flex-col items-center group flex-1 min-w-[20px] max-w-[40px]">
        
        <!-- Tooltip Area -->
        <div class="relative w-full h-full flex items-end justify-center rounded-t-md hover:bg-white/5 transition-colors overflow-visible border-b border-white/10 group-hover:border-white/30 cursor-crosshair">
           
           <!-- Rich Tooltip -->
           <div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-2 px-3 rounded-xl border border-white/10 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none min-w-[160px] whitespace-nowrap">
             <div class="font-bold text-muted border-b border-white/10 pb-1 mb-1 text-center">${item.label}</div>
             <div class="flex items-center justify-between gap-4 whitespace-nowrap">
                <span class="text-muted">Income</span>
                <span class="font-bold text-success text-right tabular-nums">${format(item.income)}</span>
             </div>
             <div class="flex items-center justify-between gap-4 whitespace-nowrap">
                <span class="text-muted">Expenses</span>
                <span class="font-bold text-danger text-right tabular-nums">${format(item.expenses)}</span>
             </div>
             <div class="flex items-center justify-between gap-4 mt-1 pt-1 border-t border-white/10 whitespace-nowrap">
                <span class="text-muted">Profit</span>
                <span class="font-bold border px-1 rounded text-right tabular-nums ${item.profit > 0 ? 'text-success border-success/20 bg-success/10' : item.profit < 0 ? 'text-danger border-danger/20 bg-danger/10' : 'text-text border-white/10 bg-white/5'}">${format(item.profit)}</span>
             </div>
           </div>

           <!-- Dual Bars (Grouped) -->
           <div class="flex items-end gap-[1px] w-full h-full px-[2px]">
              <div class="flex-1 rounded-t-sm transition-all duration-500 ease-out bg-success/80 group-hover:bg-success" 
                   style="height: ${incomePct}%;"></div>
              <div class="flex-1 rounded-t-sm transition-all duration-500 ease-out bg-danger/80 group-hover:bg-danger" 
                   style="height: ${expensesPct}%;"></div>
           </div>
        </div>
        
        <!-- X-Axis Label -->
        <span class="text-[9px] font-bold text-muted uppercase tracking-wider truncate w-full text-center pt-2" title="${item.label}">${item.label}</span>
      </div>
    `;
  }).join('');

  // Calculate total needed width: each day gets ~60px
  const minWidth = visibleData.length * 60;

  return `
    <style>
      .saas-scrollbar-thin::-webkit-scrollbar {
        height: 4px;
      }
      .saas-scrollbar-thin::-webkit-scrollbar-track {
        background: transparent;
      }
      .saas-scrollbar-thin::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
      }
      .saas-scrollbar-thin::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    </style>
    <div class="w-full overflow-x-auto overflow-y-hidden saas-scrollbar-thin pb-2" style="height: ${height}; max-height: 250px;">
      <div class="flex items-end justify-between gap-1 sm:gap-2 px-1 pt-8 h-full shrink-0 relative" style="min-width: ${minWidth}px;">
        ${bars}
      </div>
    </div>
  `;
}
