// frontend/src/components/ui/ChartWrapper.js
function SimpleBarChart(data, options = {}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const { height = "200px", color = "var(--primary)", format = (val) => val } = options;
  const bars = data.map((item) => {
    const pct = item.value / max * 100;
    return `
      <div class="flex flex-col items-center group min-w-[32px] flex-1 h-full">
        <div class="relative w-full h-full flex items-end justify-center rounded-t-md hover:bg-white/5 transition-colors overflow-visible border-b border-white/10">
           <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface text-text text-[10px] font-bold py-1 px-2 rounded-lg border border-white/10 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none" style="z-index: 10000;">
             ${format(item.value)}
           </div>
           <div class="w-full max-w-[32px] rounded-t-sm transition-all duration-500 ease-out" 
                style="height: ${pct}%; background-color: ${color};"></div>
        </div>
        <span class="text-[9px] font-bold text-muted uppercase tracking-wider truncate w-full text-center pt-2">${item.label}</span>
      </div>
    `;
  }).join("");
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
function SimpleDonutChart(data, options = {}) {
  const safeData = Array.isArray(data) ? data : [];
  const rawTotal = safeData.reduce((sum, d) => sum + Number(d?.value || 0), 0);
  const total = rawTotal || 1;
  const {
    size = 192,
    cutout = "20%",
    centerLabel = "Total",
    centerValue = rawTotal,
    legendValueFormatter = (item) => `${(Number(item.value || 0) / total * 100).toFixed(0)}%`,
    legendToneByItem = () => "text-text"
  } = options;
  let currentStart = 0;
  const gradients = safeData.map((item) => {
    const pct = Number(item.value || 0) / total * 100;
    const start = currentStart;
    const end = currentStart + pct;
    currentStart = end;
    return `${item.color || "var(--primary)"} ${start}% ${end}%`;
  }).join(", ");
  const legend = safeData.map((item) => {
    const legendValue = legendValueFormatter(item);
    return `
    <div class="flex min-w-0 items-center gap-2 text-xs text-text">
      <span class="w-3 h-3 rounded-full" style="background-color: ${item.color || "var(--primary)"}"></span>
      <span class="min-w-0 flex-1 truncate ${legendToneByItem(item)}">${item.label}</span>
      ${legendValue ? `<span class="text-muted ml-auto font-medium">${legendValue}</span>` : ""}
    </div>
  `;
  }).join("");
  return `
    <div class="flex h-full w-full flex-col items-center justify-start gap-4 overflow-x-hidden">
      <div class="relative shrink-0 rounded-full" style="width: ${size}px; height: ${size}px; background: conic-gradient(${gradients || "var(--border) 0 100%"})">
        <!-- Inner cutout for donut -->
        <div class="absolute rounded-full bg-surface flex flex-col items-center justify-center m-auto shadow-inner text-center" style="inset: ${cutout};">
          <span class="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">${centerLabel}</span>
          <span class="text-2xl font-black leading-none text-text">${centerValue}</span>
        </div>
      </div>
      <div class="flex w-full max-w-[300px] min-w-0 flex-col gap-1.5">
        ${legend}
      </div>
    </div>
  `;
}
function MultiBarChart(data, options = {}) {
  if (!Array.isArray(data) || data.length === 0) {
    return `
      <div class="h-full w-full flex items-center justify-center text-sm text-muted">
        No chart data for selected period.
      </div>
    `;
  }
  const rawMax = Math.max(...data.flatMap((d) => [Number(d.income || 0), Number(d.expenses || 0)]), 0);
  const safeMax = Math.max(rawMax, 100);
  const scaledMax = safeMax * 1.1;
  const { height = "250px", maxHeight = null, format = (val) => val } = options;
  let visibleData = data;
  const bars = visibleData.map((item) => {
    const incomeValue = Math.max(Number(item.income || 0), 0);
    const expenseValue = Math.max(Number(item.expenses || 0), 0);
    const incomePct = incomeValue > 0 ? Math.max(incomeValue / scaledMax * 100, 8) : 0;
    const expensesPct = expenseValue > 0 ? Math.max(expenseValue / scaledMax * 100, 8) : 0;
    return `
      <div class="relative z-10 flex flex-col items-center group flex-1 min-w-[44px] max-w-[60px] h-full">
        
        <!-- Tooltip Area -->
        <div class="relative w-full flex-1 min-h-0 flex items-end justify-center rounded-t-md hover:bg-white/5 transition-colors overflow-visible border-b border-white/10 group-hover:border-white/30 cursor-crosshair">
           
           <!-- Rich Tooltip -->
           <div class="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-2 px-3 rounded-xl border border-white/10 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none min-w-[160px] whitespace-nowrap" style="z-index: 10000;">
             <div class="font-bold text-muted border-b border-white/10 pb-1 mb-1 text-center">${item.label}</div>
             <div class="flex items-center justify-between gap-4 whitespace-nowrap">
                <span class="text-muted">Income:</span>
                <span class="font-bold text-success text-right tabular-nums">${format(item.income)}</span>
             </div>
             <div class="flex items-center justify-between gap-4 whitespace-nowrap">
                <span class="text-muted">Expenses:</span>
                <span class="font-bold text-danger text-right tabular-nums">${format(item.expenses)}</span>
             </div>
             <div class="flex items-center justify-between gap-4 mt-1 pt-1 border-t border-white/10 whitespace-nowrap">
                <span class="text-muted">Profit:</span>
                <span class="font-bold border px-1 rounded text-right tabular-nums ${item.profit > 0 ? "text-success border-success/20 bg-success/10" : item.profit < 0 ? "text-danger border-danger/20 bg-danger/10" : "text-text border-white/10 bg-white/5"}">${format(item.profit)}</span>
             </div>
           </div>

           <!-- Dual Bars (Grouped) -->
           <div class="flex items-end gap-[1px] w-full h-full px-[2px]">
              <div class="flex-1 rounded-t-sm transition-all duration-500 ease-out group-hover:brightness-110" 
                   style="height: ${incomePct}%; background-color: #22c55e; opacity: 1;"></div>
              <div class="flex-1 rounded-t-sm transition-all duration-500 ease-out group-hover:brightness-110" 
                   style="height: ${expensesPct}%; background-color: #ef4444; opacity: 1;"></div>
           </div>
        </div>
        
        <!-- X-Axis Label -->
        <span class="pt-1 text-[11px] font-bold text-muted tracking-wide whitespace-nowrap leading-none">${item.label}</span>
      </div>
    `;
  }).join("");
  const minWidth = visibleData.length * 62;
  const maxHeightStyle = maxHeight ? `max-height: ${maxHeight};` : "";
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
    <div class="relative w-full overflow-x-auto overflow-y-visible saas-scrollbar-thin pb-1" style="height: ${height}; ${maxHeightStyle}">
      <div class="absolute left-0 right-0 bottom-[18px] h-px bg-white/10 pointer-events-none"></div>
      <div class="flex items-end justify-between gap-1 sm:gap-2 px-2 pt-2 pb-[18px] h-full shrink-0 relative" style="min-width: ${minWidth}px;">
        ${bars}
      </div>
    </div>
  `;
}
export {
  MultiBarChart,
  SimpleBarChart,
  SimpleDonutChart
};
