const fs = require('fs');
let code = fs.readFileSync('components/admin/admin-analytics-page.tsx', 'utf8');

const oldMembershipSection = `<section className="rounded-2xl border border-white/10 bg-slate-950 p-5">
            <h2 className="text-lg font-semibold text-white">{dict.analyticsMembershipSectionTitle}</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <article className="rounded-2xl bg-white/[0.03] p-4">
                <h3 className="text-xs uppercase tracking-[0.14em] text-slate-500">{dict.analyticsMembershipNew}</h3>
                <p className="mt-2 text-lg font-semibold text-slate-100">{data.membership.newCount.toLocaleString(locale)}</p>
              </article>
              <article className="rounded-2xl bg-white/[0.03] p-4">
                <h3 className="text-xs uppercase tracking-[0.14em] text-slate-500">{dict.analyticsMembershipRenewed}</h3>
                <p className="mt-2 text-lg font-semibold text-slate-100">{data.membership.renewedCount.toLocaleString(locale)}</p>
              </article>
              <article className="rounded-2xl bg-white/[0.03] p-4">
                <h3 className="text-xs uppercase tracking-[0.14em] text-slate-500">{dict.analyticsMembershipExpired}</h3>
                <p className="mt-2 text-lg font-semibold text-slate-100">{data.membership.expiredCount.toLocaleString(locale)}</p>
              </article>
              <article className="rounded-2xl bg-white/[0.03] p-4">
                <h3 className="text-xs uppercase tracking-[0.14em] text-slate-500">{dict.analyticsMembershipRevenue}</h3>
                <p className="mt-2 text-lg font-semibold text-slate-100">{formatMoney(data.membership.membershipRevenue, locale)}</p>
              </article>
            </div>
          </section>`;

const newMembershipSection = `<section className="rounded-2xl border border-white/10 bg-slate-950 p-5">
            <h2 className="text-lg font-semibold text-white">Membership Stats</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <article className="rounded-2xl bg-white/[0.03] p-4">
                <h3 className="text-xs uppercase tracking-[0.14em] text-slate-500">Active Members</h3>
                <p className="mt-2 text-lg font-semibold text-slate-100">{data.kpis.activeMemberships.toLocaleString(locale)}</p>
              </article>
              <article className="rounded-2xl bg-white/[0.03] p-4">
                <h3 className="text-xs uppercase tracking-[0.14em] text-slate-500">Expiring Soon</h3>
                <p className="mt-2 text-lg font-semibold text-slate-100">{data.alerts.expiringMemberships.length.toLocaleString(locale)}</p>
              </article>
              <article className="rounded-2xl bg-white/[0.03] p-4">
                <h3 className="text-xs uppercase tracking-[0.14em] text-slate-500">New This Month</h3>
                <p className="mt-2 text-lg font-semibold text-slate-100">{data.kpis.newMembershipsInRange.toLocaleString(locale)}</p>
              </article>
              <article className="rounded-2xl bg-white/[0.03] p-4">
                <h3 className="text-xs uppercase tracking-[0.14em] text-slate-500">{dict.analyticsMembershipRevenue}</h3>
                <p className="mt-2 text-lg font-semibold text-slate-100">{formatMoney(data.membership.membershipRevenue, locale)}</p>
              </article>
            </div>
          </section>`;

if(code.indexOf(oldMembershipSection) !== -1) {
  code = code.replace(oldMembershipSection, newMembershipSection);
} else {
  const normalizedOld = oldMembershipSection.replace(/\n/g, "\r\n");
  code = code.replace(normalizedOld, newMembershipSection);
}

const executiveSummaryRegex = /<section className="grid gap-6 xl:grid-cols-\[1\.2fr_0\.8fr\]">[\s\S]*?<\/section>/;

const newWidgetsCode = `
          {/* ALERTS CENTER & PROFIT TREND */}
          <section className="grid gap-4 lg:grid-cols-2">
            
            {/* Alerts Center */}
            <article className="rounded-2xl border border-rose-500/20 bg-slate-950 p-5">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                <h2 className="text-lg font-semibold text-white">Alerts Center</h2>
              </div>
              <div className="mt-4 space-y-4">
                {data.alerts.lowInventory.length > 0 && (
                  <div className="rounded-xl bg-orange-500/10 p-4 border border-orange-500/20">
                    <h3 className="text-sm font-semibold text-orange-400 mb-2">Low Inventory ({data.alerts.lowInventory.length})</h3>
                    <ul className="space-y-2 text-sm text-slate-300">
                      {data.alerts.lowInventory.slice(0, 5).map(item => (
                        <li key={item.partId} className="flex justify-between">
                          <span>{item.name}</span>
                          <span className="text-orange-300 font-mono">{item.stockQty} / {item.lowStockThreshold}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {data.alerts.overdueCustomerDebt.length > 0 && (
                  <div className="rounded-xl bg-rose-500/10 p-4 border border-rose-500/20">
                    <h3 className="text-sm font-semibold text-rose-400 mb-2">Overdue Debts ({data.alerts.overdueCustomerDebt.length})</h3>
                    <ul className="space-y-2 text-sm text-slate-300">
                      {data.alerts.overdueCustomerDebt.slice(0, 5).map(c => (
                        <li key={c.customerId} className="flex justify-between">
                          <span>{c.name}</span>
                          <span className="text-rose-300 font-medium">{formatMoney(c.balanceDue, locale)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {data.alerts.absentEmployeesToday.length > 0 && (
                  <div className="rounded-xl bg-purple-500/10 p-4 border border-purple-500/20">
                    <h3 className="text-sm font-semibold text-purple-400 mb-2">Absent Employees Today</h3>
                    <ul className="space-y-2 text-sm text-slate-300">
                      {data.alerts.absentEmployeesToday.map(emp => (
                        <li key={emp.employeeId}>- {emp.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {data.alerts.expiringMemberships.length > 0 && (
                  <div className="rounded-xl bg-amber-500/10 p-4 border border-amber-500/20">
                    <h3 className="text-sm font-semibold text-amber-400 mb-2">Expiring Memberships ({data.alerts.expiringMemberships.length})</h3>
                    <ul className="space-y-2 text-sm text-slate-300">
                      {data.alerts.expiringMemberships.slice(0, 5).map(m => (
                        <li key={m.memberId} className="flex justify-between">
                          <span className="truncate pr-2">{m.name}</span>
                          <span className="text-amber-300 text-xs shrink-0">{new Date(m.expiresAt).toLocaleDateString(locale)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {!data.alerts.lowInventory.length && !data.alerts.overdueCustomerDebt.length && !data.alerts.absentEmployeesToday.length && !data.alerts.expiringMemberships.length && (
                  <div className="text-sm text-slate-400 text-center py-4">All clear! No pending alerts.</div>
                )}
              </div>
            </article>

            {/* Profit Trend Chart */}
            <article className="rounded-2xl border border-white/10 bg-slate-950 p-5">
              <h2 className="text-lg font-semibold text-white">Profit Trend (Last 7 Days)</h2>
              <ChartFrame>
                <LineChart data={data.profitTrend} margin={{ top: 10, right: 12, left: 0, bottom: 30 }}>
                  <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="date" tickFormatter={(v) => toDisplayDate(v, locale)} minTickGap={20} tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => Number(v||0).toLocaleString()} />
                  <Tooltip
                    allowEscapeViewBox={{ x: true, y: true }}
                    contentStyle={{ backgroundColor: "#020617", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, color: "#e2e8f0" }}
                    wrapperStyle={CHART_TOOLTIP_WRAPPER_STYLE}
                    labelFormatter={(v) => toDisplayDate(v, locale)}
                    formatter={(val) => [formatMoney(Number(val||0), locale), "Profit"]}
                  />
                  <Line type="monotone" dataKey="profit" stroke="rgb(59 130 246)" strokeWidth={3} dot={{ r: 4, fill: "rgb(59 130 246)", strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ChartFrame>
            </article>

          </section>

          {/* REVENUE TODAY & SERVICE DISTRIBUTION */}
          <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            {/* Revenue Today */}
            <article className="rounded-2xl border border-white/10 bg-slate-950 p-5">
              <h2 className="text-lg font-semibold text-white">Revenue Today (Hourly)</h2>
              <ChartFrame>
                <LineChart data={data.todayData.hourlyRevenue} margin={{ top: 10, right: 12, left: 0, bottom: 30 }}>
                  <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="hour" tickFormatter={(v) => new Date(v).toLocaleTimeString(locale, {hour: '2-digit', minute:'2-digit'})} minTickGap={20} tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => Number(v||0).toLocaleString()} />
                  <Tooltip
                    allowEscapeViewBox={{ x: true, y: true }}
                    contentStyle={{ backgroundColor: "#020617", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, color: "#e2e8f0" }}
                    wrapperStyle={CHART_TOOLTIP_WRAPPER_STYLE}
                    labelFormatter={(v) => new Date(v).toLocaleTimeString(locale, {hour: '2-digit', minute:'2-digit'})}
                    formatter={(val) => [formatMoney(Number(val||0), locale), "Revenue"]}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="rgb(34 197 94)" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                </LineChart>
              </ChartFrame>
            </article>

            {/* Service Status Distribution (Today) */}
            <article className="rounded-2xl border border-white/10 bg-slate-950 p-5">
              <h2 className="text-lg font-semibold text-white">Today's Service Status</h2>
              <ChartFrame>
                <PieChart>
                  <Tooltip
                    allowEscapeViewBox={{ x: true, y: true }}
                    contentStyle={{ backgroundColor: "#020617", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, color: "#e2e8f0" }}
                    wrapperStyle={CHART_TOOLTIP_WRAPPER_STYLE}
                  />
                  <Pie
                    data={data.todayData.statusDistribution.map(d => ({ ...d, name: statusText(d.status, dict) }))}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {data.todayData.statusDistribution.map((entry, index) => {
                      const colors = ["#10b981", "#3b82f6", "#f59e0b", "#64748b", "#ef4444", "#a855f7"];
                      return <Cell key={entry.status} fill={colors[index % colors.length]} />;
                    })}
                  </Pie>
                </PieChart>
              </ChartFrame>
            </article>
          </section>

          {/* TODAYS BOOKINGS, WAITING CARS, TOP EMPLOYEES */}
          <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr_1fr]">
            {/* Today's Services */}
            <article className="rounded-2xl border border-white/10 bg-slate-950 p-5 flex flex-col h-full max-h-[400px]">
              <h2 className="text-lg font-semibold text-white shrink-0">Today's Services</h2>
              <div className="mt-4 overflow-y-auto pr-1 flex-1 space-y-3">
                {data.todayData.services.length > 0 ? data.todayData.services.map(s => (
                  <div key={s.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:bg-white/[0.04] transition">
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-semibold text-slate-200">{s.carName}</p>
                      <span className={"rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider " + statusBadgeClass(s.status)}>
                        {statusText(s.status, dict)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mb-2 truncate">{s.serviceName}</p>
                    <div className="flex justify-between text-xs text-slate-500 font-mono">
                      <span>{s.employeeName ? "\\uD83D\\uDC68\\u200D\\uD83D\\uDD27 " + s.employeeName : 'Unassigned'}</span>
                      <span>\\u23F0 {new Date(s.appointmentAt).toLocaleTimeString(locale, {hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-slate-500 text-center py-6 mt-6">No services scheduled for today</p>
                )}
              </div>
            </article>

            {/* Waiting Customers */}
            <article className="rounded-2xl border border-white/10 bg-slate-950 p-5 flex flex-col h-full max-h-[400px]">
              <h2 className="text-lg font-semibold text-white shrink-0">Waiting Customers</h2>
              <div className="mt-4 overflow-y-auto pr-1 flex-1 space-y-3">
                {data.todayData.waitingCars.length > 0 ? data.todayData.waitingCars.map(w => {
                  const waitingMins = Math.max(0, Math.floor((Date.now() - new Date(w.waitingSince).getTime()) / 60000));
                  return (
                    <div key={w.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3 flex justify-between items-center gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-200 truncate">{w.carName}</p>
                        <p className="text-xs text-slate-400 truncate">{w.serviceName}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={"text-xs font-bold " + (waitingMins > 30 ? 'text-rose-400' : 'text-amber-400')}>
                          {waitingMins} min
                        </span>
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-sm text-slate-500 text-center py-6 mt-6">No waiting cars right now</p>
                )}
              </div>
            </article>

            {/* Top Employees Today */}
            <article className="rounded-2xl border border-white/10 bg-slate-950 p-5 flex flex-col h-full max-h-[400px]">
              <h2 className="text-lg font-semibold text-white shrink-0">Top Employees Today</h2>
              <div className="mt-4 overflow-y-auto pr-1 flex-1 space-y-3">
                {data.todayData.topEmployees.length > 0 ? data.todayData.topEmployees.map((e, idx) => (
                  <div key={e.name} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-200 truncate">{e.name}</p>
                      <p className="text-xs text-slate-400">{e.jobsCompleted} job{e.jobsCompleted!==1?'s':''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-emerald-400">{formatMoney(e.revenue, locale)}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-slate-500 text-center py-6 mt-6">No jobs completed yet today</p>
                )}
              </div>
            </article>
          </section>
`;

if(code.indexOf("Alerts Center") === -1) {
  code = code.replace(executiveSummaryRegex, '$&\n' + newWidgetsCode);
  fs.writeFileSync('components/admin/admin-analytics-page.tsx', code);
}
