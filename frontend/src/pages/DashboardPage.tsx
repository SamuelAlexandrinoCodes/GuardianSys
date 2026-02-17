import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  Building2,
  Baby,
  Briefcase,
  Glasses,
  AlertTriangle,
  CalendarDays,
  Handshake,
  CheckCircle2,
  CreditCard,
  Cake,
  ClipboardList,
  ChevronDown,
} from "lucide-react";
import type { DashboardData } from "../types";
import { api } from "../lib/api";
import { Link } from "react-router-dom";

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState<string | undefined>(undefined);

  const fetchData = useCallback(async () => {
    try {
      const result = await api.getDashboard(viewDate);
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [viewDate]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const navigate = useCallback(
    (days: number) => {
      const current = data?.view_date || new Date().toISOString().split("T")[0];
      const d = new Date(current + "T12:00:00");
      d.setDate(d.getDate() + days);
      setViewDate(d.toISOString().split("T")[0]);
    },
    [data]
  );

  if (loading || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={24} strokeWidth={1.5} className="animate-spin text-slate-300 dark:text-zinc-600" />
      </div>
    );
  }

  const { stats, birthdays_today, birthdays_month, payables_pending, reservations_today, tasks_pending, tasks_overdue, meetings_today } = data;

  return (
    <div className="h-full overflow-y-auto scrollbar-none">
      <div className="mx-auto max-w-6xl px-8 py-6">
        {/* Header with date nav */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              {data.is_today
                ? `Bom dia, ${data.config.user_name || "Comando"}`
                : "Navegacao"}
            </h1>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
              Visao Geral
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm dark:border-white/[0.06] dark:bg-zinc-900">
            <button onClick={() => navigate(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800">
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <div className="min-w-[120px] px-3 text-center">
              <p className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                {new Date(data.view_date + "T12:00:00").toLocaleDateString("pt-BR")}
              </p>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                {data.view_date_label}
              </p>
            </div>
            <button onClick={() => navigate(1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800">
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={Users} label="Populacao" value={stats.total_residents} suffix="hab" sub={`${stats.occupancy}% ocupacao`} progress={stats.occupancy} />
          <KpiCard icon={Building2} label="Unidades" value={stats.total_units} sub={`${stats.total_units - Math.round(stats.total_units * stats.occupancy / 100)} vazias`} />
          <ProfileCard owners={stats.owners} tenants={stats.tenants} total={stats.total_residents} />
          <DemographyCard kids={stats.demography.kids} adults={stats.demography.adults} seniors={stats.demography.seniors} />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Overdue alert */}
            {tasks_overdue.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-4 rounded-2xl border border-red-200/60 bg-red-50/50 p-5 dark:border-red-500/20 dark:bg-red-500/5">
                <AlertTriangle size={20} strokeWidth={1.5} className="mt-0.5 shrink-0 text-red-500" />
                <div>
                  <h3 className="text-sm font-bold text-red-800 dark:text-red-400">Atencao: Atrasos</h3>
                  <p className="mt-0.5 text-xs text-red-600 dark:text-red-400/80">{tasks_overdue.length} pendencia(s) critica(s).</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tasks_overdue.map((t) => (
                      <Link to="/administrativo" key={t.id} className="rounded-lg border border-red-200 bg-white px-2 py-1 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-50 dark:border-red-500/20 dark:bg-zinc-900 dark:text-red-400">
                        {t.title} {t.due_date && `(${new Date(t.due_date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })})`}
                      </Link>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Agenda */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-white/[0.06] dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-slate-100/80 px-6 py-4 dark:border-white/[0.04]">
                <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-zinc-100">Agenda Operacional</h3>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
                  {data.is_today ? "Hoje" : new Date(data.view_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                </span>
              </div>
              <div className="divide-y divide-slate-100/60 dark:divide-white/[0.04]">
                {/* Meetings */}
                {meetings_today.length > 0 && (
                  <AgendaSection icon={Handshake} label="Reunioes" color="indigo">
                    {meetings_today.map((m) => (
                      <Link to="/administrativo" key={m.id} className="block rounded-xl border border-indigo-100/60 bg-indigo-50/30 p-3.5 transition-colors hover:bg-indigo-50 dark:border-indigo-500/10 dark:bg-indigo-500/5 dark:hover:bg-indigo-500/10">
                        <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{m.title}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-500">{m.reason || "Reuniao operacional"}</p>
                      </Link>
                    ))}
                  </AgendaSection>
                )}
                {/* Reservations */}
                {reservations_today.length > 0 && (
                  <AgendaSection icon={CalendarDays} label="Reservas" color="orange">
                    {reservations_today.map((r) => (
                      <Link to="/reservations" key={r.id} className="block rounded-xl border border-orange-100/60 bg-orange-50/30 p-3.5 transition-colors hover:bg-orange-50 dark:border-orange-500/10 dark:bg-orange-500/5 dark:hover:bg-orange-500/10">
                        <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{r.area_name.replace("_", " ")}</p>
                        <p className="mt-0.5 text-[11px] text-orange-600 dark:text-orange-400">Apto {r.unit.number}{r.resident ? ` — ${r.resident.full_name}` : ""}</p>
                      </Link>
                    ))}
                  </AgendaSection>
                )}
                {/* Tasks */}
                {tasks_pending.length > 0 && (
                  <AgendaSection icon={CheckCircle2} label="Tarefas" color="emerald">
                    {tasks_pending.slice(0, 6).map((t) => (
                      <Link to="/administrativo" key={t.id} className="flex items-center gap-3 rounded-xl border border-slate-100/60 bg-white p-3 transition-colors hover:bg-slate-50 dark:border-white/[0.04] dark:bg-zinc-800/50 dark:hover:bg-zinc-800">
                        <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] border-emerald-400 dark:border-emerald-500" />
                        <span className="flex-1 text-sm font-medium text-slate-700 dark:text-zinc-300">{t.title}</span>
                        {t.due_date && (
                          <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500">
                            {new Date(t.due_date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                          </span>
                        )}
                      </Link>
                    ))}
                  </AgendaSection>
                )}
                {meetings_today.length === 0 && reservations_today.length === 0 && tasks_pending.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16">
                    <ClipboardList size={32} strokeWidth={1} className="mb-3 text-slate-200 dark:text-zinc-700" />
                    <p className="text-sm font-semibold text-slate-300 dark:text-zinc-600">Agenda livre.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Birthdays */}
            <BirthdaysCard today={birthdays_today} month={birthdays_month} viewDate={data.view_date} />

            {/* Payables alert */}
            {payables_pending.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border-l-4 border-l-red-500 border border-slate-200/60 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-zinc-900">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-red-600 dark:text-red-400">
                  <CreditCard size={14} strokeWidth={1.5} />
                  Contas vencendo
                </h3>
                <div className="space-y-2">
                  {payables_pending.map((p) => (
                    <Link to="/administrativo" key={p.id} className="flex items-center justify-between rounded-xl border border-red-100/60 bg-red-50/30 p-3 transition-colors hover:bg-red-50 dark:border-red-500/10 dark:bg-red-500/5">
                      <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">{p.description}</span>
                      <span className="text-sm font-bold text-red-700 dark:text-red-400">R$ {p.amount.toFixed(2)}</span>
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({ icon: Icon, label, value, suffix, sub, progress }: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string; value: number; suffix?: string; sub?: string; progress?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-white/[0.06] dark:bg-zinc-900">
      <div className="mb-1 flex items-center gap-2">
        <Icon size={14} strokeWidth={1.5} className="text-slate-400 dark:text-zinc-500" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">{value}</span>
        {suffix && <span className="text-sm font-medium text-slate-400 dark:text-zinc-500">{suffix}</span>}
      </div>
      {sub && <p className="mt-1 text-[11px] font-medium text-slate-400 dark:text-zinc-500">{sub}</p>}
      {progress !== undefined && (
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
          <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }} className="h-full rounded-full bg-indigo-500" />
        </div>
      )}
    </motion.div>
  );
}

function ProfileCard({ owners, tenants, total }: { owners: number; tenants: number; total: number }) {
  const ownerPct = total > 0 ? Math.round((owners / total) * 100) : 0;
  const tenantPct = total > 0 ? Math.round((tenants / total) * 100) : 0;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-zinc-900">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Perfil</span>
      <div className="mt-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-500" /><span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Proprietarios</span></div>
          <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">{owners}</span>
        </div>
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
          <div className="h-full bg-blue-500" style={{ width: `${ownerPct}%` }} />
          <div className="h-full bg-orange-400" style={{ width: `${tenantPct}%` }} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-orange-400" /><span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Inquilinos</span></div>
          <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">{tenants}</span>
        </div>
      </div>
    </motion.div>
  );
}

function DemographyCard({ kids, adults, seniors }: { kids: number; adults: number; seniors: number }) {
  const items = [
    { icon: Baby, label: "Criancas", value: kids, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
    { icon: Briefcase, label: "Adultos", value: adults, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-500/10" },
    { icon: Glasses, label: "Idosos", value: seniors, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-500/10" },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-zinc-900">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Demografia</span>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {items.map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className={`flex flex-col items-center rounded-xl ${bg} p-2.5`}>
            <Icon size={16} strokeWidth={1.5} className={color} />
            <span className={`mt-1 text-lg font-bold ${color}`}>{value}</span>
            <span className="text-[8px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">{label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function AgendaSection({ icon: Icon, label, color, children }: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string; color: string; children: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    indigo: "text-indigo-500 dark:text-indigo-400",
    orange: "text-orange-500 dark:text-orange-400",
    emerald: "text-emerald-500 dark:text-emerald-400",
  };
  return (
    <div className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={13} strokeWidth={1.5} className={colorMap[color] || "text-slate-400"} />
        <span className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${colorMap[color] || "text-slate-400"}`}>{label}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function BirthdaysCard({ today, month, viewDate }: {
  today: DashboardData["birthdays_today"]; month: DashboardData["birthdays_month"]; viewDate: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-white/[0.06] dark:bg-zinc-900">
      <div className="flex items-center justify-between bg-gradient-to-r from-pink-500 to-rose-500 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Cake size={16} strokeWidth={1.5} className="text-white/90" />
          <span className="text-xs font-bold text-white">Aniversarios</span>
        </div>
        <span className="rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">{today.length} hoje</span>
      </div>
      <div className="p-4">
        {today.length > 0 ? (
          <div className="space-y-2 mb-3">
            {today.map((b, i) => (
              <Link to={`/units`} key={i} className="flex items-center gap-3 rounded-xl border border-pink-100/60 bg-pink-50/30 p-3 transition-colors hover:bg-pink-50 dark:border-pink-500/10 dark:bg-pink-500/5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-bold text-pink-500 shadow-sm dark:bg-zinc-800">{b.age}</div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">{b.name}</p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500">Apto {b.unit_number}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-xs font-medium text-slate-300 dark:text-zinc-600">Nenhum aniversario hoje.</p>
        )}
        {month.length > 0 && (
          <>
            <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between border-t border-slate-100/60 pt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 transition-colors hover:text-pink-500 dark:border-white/[0.04] dark:text-zinc-500">
              <span>Ver mes ({month.length})</span>
              <ChevronDown size={12} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
            {expanded && (
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto scrollbar-none">
                {month.map((b, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg p-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50">
                    <span>{b.name}</span>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono dark:bg-zinc-800">{b.day}/{new Date(viewDate + "T00:00:00").getMonth() + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
