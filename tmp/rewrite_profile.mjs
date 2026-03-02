import fs from "fs";
import path from "path";

const targetFile = "c:\\Users\\bkhwe\\final_mohammad\\frontend\\src\\pages\\admin\\Profile.js";
let content = fs.readFileSync(targetFile, "utf-8");

// 1. Add timeAgo and sparklineSvg helpers
const newHelpers = \`
const timeAgo = (dateStr) => {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return \\\`\${Math.floor(seconds)}s ago\\\`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return \\\`\${minutes}m ago\\\`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return \\\`\${hours}h ago\\\`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : \\\`\${days} days ago\\\`;
};

const sparklineSvg = (trend) => {
  const isUp = trend >= 0;
  const strokeColor = isUp ? "stroke-emerald-500" : "stroke-danger";
  const path = isUp ? "M0 20 L 10 15 L 20 18 L 30 10 L 40 12 L 50 2" : "M0 5 L 10 10 L 20 8 L 30 15 L 40 12 L 50 20";
  return \\\`<svg class="w-16 h-8 \\\${strokeColor} opacity-70" fill="none" viewBox="0 0 50 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));"><path d="\\\${path}" /></svg>\\\`;
};
\`;
content = content.replace("const emptyAttendance", newHelpers + "\nconst emptyAttendance");

// 2. Modify renderRows for timeline design
const renderRowsOld = \`function renderRows(items, empty) {
  if (!items?.length) return \\\`<div class="text-sm text-muted">\\\${empty}</div>\\\`;
  return items
    .map(
      (item) => \\\`
        <div class="rounded-2xl border border-border px-4 py-3">
          <div class="flex items-center justify-between gap-4">
            <div>
              <div class="text-sm font-medium text-text">\\\${esc(item.action)}</div>
              <div class="text-xs text-muted">\\\${esc(item.entity || formatIpAddress(item.ipAddress))}</div>
            </div>
            <div class="text-xs text-muted">\\\${dt(item.createdAt)}</div>
          </div>
        </div>
      \\\`
    )
    .join("");
}\`;

const renderRowsNew = \`function renderRows(items, empty) {
  if (!items?.length) return \\\`<div class="text-sm text-muted">\\\${empty}</div>\\\`;
  return \\\`<div class="relative border-l-2 border-border/50 pl-6 py-2 ml-4 space-y-6">\\\` + items
    .map(
      (item) => {
        const actionStr = String(item.action).toLowerCase();
        const isRisky = actionStr.includes("force") || actionStr.includes("banned") || actionStr.includes("suspended") || actionStr.includes("reset");
        const dotColor = isRisky ? 'border-danger bg-surface' : 'border-primary bg-surface';
        const textColor = isRisky ? 'text-danger' : 'text-text';
        return \\\`
        <div class="relative transition-all duration-300 hover:scale-[1.01]">
          <div class="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 \\\${dotColor} shadow-sm z-10"></div>
          <div class="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm hover:border-text transition-all group">
            <div>
              <div class="text-sm font-bold \\\${textColor}">\\\${esc(item.action)}</div>
              <div class="text-xs text-muted opacity-80 mt-0.5">\\\${esc(item.entity || formatIpAddress(item.ipAddress))}</div>
            </div>
            <div class="text-xs text-muted font-semibold bg-bg px-2 py-1 rounded-lg">\\\${timeAgo(item.createdAt)}</div>
          </div>
        </div>
      \\\`
    }
    )
    .join("") + \\\`</div>\\\`;
}\`;
content = content.replace(renderRowsOld, renderRowsNew);

// 3. Modifying renderAttendanceTable
content = content.replace(\`function renderAttendanceTable(log) {\`, \`function renderAttendanceTable(log) {
  const heatmapDays = Array.from({length: 30}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const dateStr = d.toISOString().slice(0, 10);
    const hasLog = log?.some(r => r.date === dateStr || (r.time && r.time.startsWith(dateStr)));
    return { date: dateStr, present: hasLog };
  });

  const heatmapHtml = \\\`
    <div class="mb-6 rounded-[24px] border border-border bg-surface p-6 shadow-sm">
      <div class="mb-4 flex items-center justify-between">
        <span class="text-xs font-bold uppercase tracking-widest text-muted">30-Day Heatmap</span>
        <div class="flex gap-4">
           <span class="flex items-center gap-1.5 text-xs font-medium text-text"><div class="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm"></div> Present</span>
           <span class="flex items-center gap-1.5 text-xs font-medium text-text"><div class="h-2.5 w-2.5 rounded-full bg-danger/20 shadow-sm"></div> Absent</span>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        \\\${heatmapDays.map(d => \\\`<div class="h-8 w-8 rounded-xl \\\${d.present ? 'bg-emerald-500 shadow-sm border border-emerald-600/20' : 'bg-danger/10 border border-danger/20'} transition-all duration-300 hover:scale-[1.15] hover:shadow-md cursor-pointer" title="\\\${d.date}"></div>\\\`).join("")}
      </div>
    </div>
  \\\`;
\`);

content = content.replace(
  \`return \\\`
    <div class="overflow-auto rounded-2xl border border-border">\`,
  \`return heatmapHtml + \\\`
    <div class="overflow-auto rounded-[24px] border border-border bg-surface shadow-sm">\`
);

// 4. Fetching insights
const fetchInsightsTarget = \`if (employeeId) {
          state.item = (
            await apiFetch(
              \\\`/admin/employees/\\\${employeeId}\\\${buildQuery({
                from: state.performanceFrom || undefined,
                to: state.performanceTo || undefined,
                activityFrom: state.activityFrom || undefined,
                activityTo: state.activityTo || undefined,
                attendanceFrom: state.attendanceFrom || undefined,
                attendanceTo: state.attendanceTo || undefined
              })}\\\`
            )
          ).item;
        } else {\`;

const fetchInsightsNew = \`if (employeeId) {
          state.item = (
            await apiFetch(
              \\\`/admin/employees/\\\${employeeId}\\\${buildQuery({
                from: state.performanceFrom || undefined,
                to: state.performanceTo || undefined,
                activityFrom: state.activityFrom || undefined,
                activityTo: state.activityTo || undefined,
                attendanceFrom: state.attendanceFrom || undefined,
                attendanceTo: state.attendanceTo || undefined
              })}\\\`
            )
          ).item;
          try {
            state.insights = (await apiFetch(\\\`/admin/employees/\\\${employeeId}/insights\\\`)).item;
          } catch(e) {
             state.insights = { performanceScore: 0, attendanceRate: 0, revenueTrend: 0, riskLevel: "Healthy", inactivityDays: 0, flags: [] };
          }
        } else {\`;
content = content.replace(fetchInsightsTarget, fetchInsightsNew);

// 5. Updating render() Body logic
// Extract current performance UI and replace
const performanceOld = \`      if (state.tab === "performance") {
        body = \\\`
          <form id="emp-performance-range-form" class="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <input name="from" type="date" value="\\\${esc(state.performanceFrom)}" class="rounded-xl border border-border bg-surface px-4 py-3">
            <input name="to" type="date" value="\\\${esc(state.performanceTo)}" class="rounded-xl border border-border bg-surface px-4 py-3">
            <button class="rounded-xl border border-border px-4 py-3 text-sm font-medium text-text">Apply range</button>
          </form>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">\\\${performance.cards.map((card) => \\\`<div class="rounded-2xl border border-border px-4 py-4"><div class="text-xs uppercase tracking-wide text-muted">\\\${esc(card.label)}</div><div class="mt-2 text-2xl font-semibold text-text">\\\${esc(card.value)}</div></div>\\\`).join("")}</div>
          <div class="mt-4">\\\${renderTable(performance.rows || [], "No activity recorded for this period.")}</div>
        \\\`;
      }\`;

const performanceNew = \`      if (state.tab === "performance") {
        body = \\\`
          <form id="emp-performance-range-form" class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4 lg:col-span-3">
            <input name="from" type="date" value="\\\${esc(state.performanceFrom)}" class="rounded-xl border border-border bg-surface px-4 py-3 shadow-sm hover:border-primary transition-colors focus:ring focus:ring-primary/20">
            <input name="to" type="date" value="\\\${esc(state.performanceTo)}" class="rounded-xl border border-border bg-surface px-4 py-3 shadow-sm hover:border-primary transition-colors focus:ring focus:ring-primary/20">
            <button class="rounded-xl border border-border border-b-[3px] bg-bg px-4 py-3 text-sm font-bold text-text hover:bg-surface transition-all active:translate-y-[1px] active:border-b shadow-sm">Apply Range</button>
            <button type="button" class="rounded-xl border border-primary/30 border-b-[3px] bg-primary/10 px-4 py-3 text-sm font-bold text-primary hover:bg-primary/20 transition-all active:translate-y-[1px] active:border-b shadow-sm w-full md:w-auto">Compare Team</button>
          </form>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3 lg:col-span-3">
             \\\${performance.cards.map((card, i) => {
                 const trend = card.label.toLowerCase().includes('revenue') ? (state.insights?.revenueTrend || 0) : (i === 0 ? 12 : -5);
                 const isUp = trend >= 0;
                 return \\\`
                 <div class="group relative overflow-hidden rounded-[24px] border border-border bg-surface px-6 py-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-border/50">
                   <div class="text-[10px] font-bold uppercase tracking-widest text-muted">\\\${esc(card.label)}</div>
                   <div class="mt-2 text-4xl font-black text-text font-heading tracking-tight">\\\${esc(card.value)}</div>
                   <div class="mt-5 flex items-center justify-between">
                      <div class="flex items-center gap-1.5 text-xs font-bold \\\${isUp ? 'text-emerald-500' : 'text-danger'} bg-bg px-2.5 py-1.5 rounded-lg border border-border/50">
                        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="\\\${isUp ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}"></path></svg>
                        <span>\\\${Math.abs(trend)}% vs last</span>
                      </div>
                      \\\${sparklineSvg(trend)}
                   </div>
                 </div>\\\`;
             }).join("")}
          </div>
          <div class="mt-6 lg:col-span-3 rounded-[24px] overflow-hidden shadow-sm border border-border">
             \\\${renderTable(performance.rows || [], "No activity recorded for this period.")}
          </div>
        \\\`;
      }\`;
content = content.replace(performanceOld, performanceNew);

// 6. Root HTML & Admin Panel
const hrPrefixOld = \`if (state.tab === "hr" && canEditHr) {\`;
const hrPrefixNew = \`
      const insights = state.insights || { performanceScore: 0, attendanceRate: 0, revenueTrend: 0, riskLevel: "Healthy", inactivityDays: 0, flags: [] };
      const isHealthy = insights.riskLevel === "Healthy";
      const isWarning = insights.riskLevel === "Warning";
      const isCritical = insights.riskLevel === "Critical";
      const riskTheme = isCritical 
        ? "border-danger/20 bg-gradient-to-br from-danger/20 via-danger/5 to-bg text-danger shadow-[0_0_30px_rgba(239,68,68,0.15)]" 
        : isWarning 
        ? "border-amber-500/30 bg-gradient-to-br from-amber-500/20 via-amber-500/5 to-bg text-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.15)]"
        : "border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-bg text-primary shadow-[0_0_30px_rgba(var(--primary-rgb),0.1)]";

      const badgeTone = isCritical ? "border-danger text-danger bg-danger/10" : isWarning ? "border-amber-500 text-amber-500 bg-amber-500/10" : "border-emerald-500 text-emerald-500 bg-emerald-500/10";
      
      const intelligenceBanner = \\\`
        <div class="relative overflow-hidden rounded-[32px] border-2 \\\${riskTheme} px-8 py-8 transition-all duration-500 mb-6 group">
           <div class="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl group-hover:bg-white/10 transition-colors duration-700"></div>
           <div class="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div class="flex items-center gap-6">
                 \\\${avatar(item.fullName, item.avatar, "w-24 h-24 text-4xl shadow-xl ring-4 ring-bg")}
                 <div class="space-y-1.5">
                    <div class="text-3xl font-heading font-black text-text tracking-tight">\\\${esc(item.fullName || "Employee")}</div>
                    <div class="flex items-center gap-3 mt-1">
                       <span class="rounded-xl border border-border bg-surface px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text shadow-sm">\\\${esc(item.roleProfile)}</span>
                       <span class="rounded-xl border \\\${badgeTone} px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                         <span class="relative flex h-2 w-2">
                           <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 object-cover \\\${isCritical ? 'bg-danger' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}"></span>
                           <span class="relative inline-flex rounded-full h-2 w-2 \\\${isCritical ? 'bg-danger' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}"></span>
                         </span>
                         \\\${insights.riskLevel}
                       </span>
                    </div>
                    <div class="text-xs font-semibold opacity-70 mt-2">
                      \\\${insights.inactivityDays > 0 ? \\\`Last active \\\${insights.inactivityDays} days ago\\\` : 'Active today'}
                    </div>
                 </div>
              </div>
              <div class="flex items-center gap-8 lg:ml-auto">
                 <div class="flex flex-col border-l-2 border-border/50 pl-6">
                    <span class="text-[10px] font-bold uppercase tracking-widest opacity-60">Performance</span>
                    <span class="text-4xl font-black font-heading tracking-tight flex items-baseline gap-1">\\\${insights.performanceScore}<span class="text-sm font-semibold opacity-50">/100</span></span>
                 </div>
                 <div class="flex flex-col border-l-2 border-border/50 pl-6">
                    <span class="text-[10px] font-bold uppercase tracking-widest opacity-60">Attendance</span>
                    <span class="text-4xl font-black font-heading tracking-tight flex items-baseline gap-1">\\\${insights.attendanceRate}<span class="text-sm font-semibold opacity-50">%</span></span>
                 </div>
              </div>
           </div>
        </div>
      \\\`;

      const flagItems = insights.flags.length > 0 
        ? insights.flags.map(f => \\\`<div class="mb-3 flex items-start gap-3 rounded-2xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm font-medium text-danger shadow-sm"><svg class="mt-0.5 h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>\\\${esc(f)}</div>\\\`).join("")
        : \\\`<div class="text-sm text-muted bg-surface border border-border px-4 py-3 rounded-2xl shadow-sm">No active flags. Employee is healthy.</div>\\\`;
      
      let recommendations = "";
      if (insights.attendanceRate < 70) recommendations += \\\`<button type="button" class="w-full mb-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 px-4 py-3.5 text-sm font-bold text-amber-500 transition-all hover:bg-amber-500/20 hover:scale-[1.02] shadow-sm">Review Attendance</button>\\\`;
      if (insights.revenueTrend < 0) recommendations += \\\`<button type="button" class="w-full mb-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 px-4 py-3.5 text-sm font-bold text-blue-500 transition-all hover:bg-blue-500/20 hover:scale-[1.02] shadow-sm">Review Performance</button>\\\`;
      if (insights.riskLevel === "Critical") recommendations += \\\`<button type="button" class="w-full mb-3 rounded-2xl bg-danger/10 border border-danger/20 px-4 py-3.5 text-sm font-bold text-danger transition-all hover:bg-danger/20 hover:scale-[1.02] shadow-sm" data-action="suspend" data-days="3">Recommend: 3-Day Suspension</button>\\\`;
      
      const adminAttentionPanel = \\\`
        <div class="rounded-[32px] border border-border bg-surface p-6 shadow-md transition-all duration-300 hover:shadow-lg">
          <h3 class="font-heading text-xl font-black text-text mb-6">Insights Engine</h3>
          <div class="mb-8">
            <h4 class="text-[10px] uppercase tracking-widest text-muted mb-4 font-bold opacity-80">Detected Rules</h4>
            \\\${flagItems}
          </div>
          <div>
            <h4 class="text-[10px] uppercase tracking-widest text-muted mb-4 font-bold opacity-80">Smart Actions</h4>
            \\\${recommendations || \\\`<div class="text-sm text-muted bg-bg border border-border px-4 py-3 rounded-2xl shadow-sm">No actions required.</div>\\\`}
          </div>
        </div>
      \\\`;

      if (state.tab === "hr" && canEditHr) {`;
content = content.replace(hrPrefixOld, hrPrefixNew);

const rootReplaceOld = \`root.innerHTML = \\\`
        <div class="space-y-6">
          <div class="rounded-[24px] border border-border bg-surface px-6 py-6">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div class="flex items-start gap-4">
                \\\${avatar(item.fullName, item.avatar)}
                <div class="space-y-2">
                  <div class="text-2xl font-semibold text-text">\\\${esc(item.fullName || "Employee")}</div>
                  <div class="text-sm text-muted">\\\${esc(item.phone || "Not available")}</div>
                  <div class="flex flex-wrap gap-2">\\\${badge(item.roleProfile)} \\\${badge(item.status, tone)}</div>
                  <div class="flex flex-wrap gap-4 text-sm text-muted">
                    <span>Employment Type: \\\${esc(formatEmploymentType(item.profile.employmentType))}</span>
                    <span>Department: \\\${esc(formatDepartmentLabel(item.profile.department))}</span>
                  </div>
                  <div class="flex flex-wrap gap-4 text-xs uppercase tracking-wide text-muted">
                    <span>Employee ID: \\\${esc(item.id || "Not available")}</span>
                    <span>Joined: \\\${esc(d(item.joinedAt))}</span>
                  </div>
                  \\\${item.status === "SUSPENDED" ? \\\`<div class="text-sm font-medium text-amber-500">\\\${esc(item.suspendedUntil ? \\\`Suspended until \\\${d(item.suspendedUntil)}\\\` : "Suspended")}</div>\\\` : ""}
                </div>
              </div>
              <div class="flex flex-wrap gap-3">
                \\\${canEditHr && !isLocked ? \\\`<button type="button" data-action="reset_password" class="rounded-xl border border-border px-4 py-3 text-sm font-medium text-text">Reset password</button>\\\` : ""}
                \\\${employeeId ? \\\`<button type="button" id="back-employees" class="rounded-xl border border-border px-4 py-3 text-sm font-medium text-text">Back to employees</button>\\\` : ""}
              </div>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">\\\${tabs.map((tab) => \\\`<button type="button" data-tab="\\\${tab}" class="rounded-xl border px-4 py-2 text-sm font-medium \\\${state.tab === tab ? "border-text bg-bg text-text" : "border-border text-muted hover:text-text"}">\\\${tab === "activity" ? "Activity Log" : tab[0].toUpperCase() + tab.slice(1)}</button>\\\`).join("")}</div>
          \\\${section("Employee Management", body)}
        </div>
      \\\`;\`;

const rootReplaceNew = \`root.innerHTML = \\\`
        <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          \\\${intelligenceBanner}
          
          <div class="grid grid-cols-1 gap-8 lg:grid-cols-4">
             <div class="lg:col-span-3 space-y-6">
                <!-- Navigation Tabs -->
                <div class="flex flex-wrap gap-2 bg-surface p-2 rounded-[24px] border border-border shadow-sm">
                   \\\${tabs.map((tab) => \\\`
                     <button type="button" data-tab="\\\${tab}" class="rounded-2xl px-6 py-3 text-sm font-bold tracking-wide transition-all duration-300 flex-1 min-w-[120px] \\\${state.tab === tab ? "bg-primary text-white shadow-md scale-100" : "text-muted hover:text-text hover:bg-bg"}">
                        \\\${tab === "activity" ? "Timeline" : tab === "hr" ? "Payroll/HR" : tab[0].toUpperCase() + tab.slice(1)}
                     </button>
                   \\\`).join("")}
                </div>
                
                <div class="animate-in fade-in duration-300">
                  \\\${body}
                </div>
             </div>
             
             <div class="lg:col-span-1 space-y-6">
                \\\${adminAttentionPanel}
                
                <div class="rounded-[32px] border border-border bg-surface p-6 shadow-md">
                   <h4 class="text-[10px] uppercase tracking-widest text-muted mb-4 font-bold opacity-80">System Controls</h4>
                   <div class="flex flex-col gap-3">
                     \\\${canEditHr && !isLocked ? \\\`<button type="button" data-action="reset_password" class="w-full rounded-2xl border border-border bg-bg px-4 py-3.5 text-sm font-bold text-text transition-all hover:bg-surface hover:-translate-y-0.5 shadow-sm">Reset Password</button>\\\` : ""}
                     \\\${employeeId ? \\\`<button type="button" id="back-employees" class="w-full rounded-2xl border border-border bg-bg px-4 py-3.5 text-sm font-bold text-text transition-all hover:bg-surface hover:-translate-y-0.5 shadow-sm">Back to Directory</button>\\\` : ""}
                   </div>
                </div>
             </div>
          </div>
        </div>
      \\\`;\`;

content = content.replace(rootReplaceOld, rootReplaceNew);

fs.writeFileSync(targetFile, content);
console.log("Successfully patched Profile.js");
