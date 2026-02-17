import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Handshake,
  CreditCard,
  CheckCircle2,
  MapPin,
  Clock,
  User,
} from "lucide-react";
import type { CalendarData, CalendarDayDetail } from "../types";
import { api } from "../lib/api";
import { SideSheet } from "../components/ui/SideSheet";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

const DOT_COLORS: Record<string, string> = {
  yellow: "bg-yellow-400",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  green: "bg-emerald-500",
  red: "bg-red-500",
};

export function CalendarPage() {
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [navDate, setNavDate] = useState<string | undefined>(undefined);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getCalendar(navDate);
      setData(res);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [navDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !data) {
    return <div className="flex h-full items-center justify-center"><Loader2 size={24} className="animate-spin text-slate-300 dark:text-zinc-600" /></div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200/60 bg-white px-8 py-4 dark:border-white/[0.06] dark:bg-zinc-950">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">Calendario</h1>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Visao mensal</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm dark:border-white/[0.06] dark:bg-zinc-900">
          <button onClick={() => setNavDate(data.prev)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800">
            <ChevronLeft size={16} strokeWidth={1.5} />
          </button>
          <div className="min-w-[140px] px-3 text-center">
            <p className="text-sm font-bold text-slate-800 dark:text-zinc-200">{data.month_label} {data.year}</p>
          </div>
          <button onClick={() => setNavDate(data.next)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800">
            <ChevronRight size={16} strokeWidth={1.5} />
          </button>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4">
          <LegendDot color="bg-yellow-400" label="Churrasqueira" />
          <LegendDot color="bg-blue-500" label="Salao" />
          <LegendDot color="bg-emerald-500" label="Reuniao" />
          <LegendDot color="bg-red-500" label="Conta" />
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-y-auto scrollbar-none p-8">
        <div className="mx-auto max-w-4xl">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-px rounded-2xl border border-slate-200/60 bg-slate-200/60 overflow-hidden dark:border-white/[0.06] dark:bg-white/[0.04]">
            {data.grid.map((cell, i) => (
              <button
                key={i}
                disabled={!cell.in_month}
                onClick={() => cell.date && setSelectedDay(cell.date)}
                className={`relative flex min-h-[80px] flex-col items-center pt-2 transition-colors ${
                  cell.in_month
                    ? "bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/50"
                    : "bg-slate-50/50 dark:bg-zinc-950/50"
                }`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  cell.is_today
                    ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : cell.in_month
                      ? "text-slate-900 dark:text-zinc-100"
                      : "text-slate-300 dark:text-zinc-700"
                }`}>
                  {cell.day}
                </span>
                {/* Micro-dots */}
                {cell.events.length > 0 && (
                  <div className="mt-1 flex items-center gap-0.5">
                    {cell.events.slice(0, 4).map((ev, j) => (
                      <span key={j} className={`h-1.5 w-1.5 rounded-full ${DOT_COLORS[ev.color] || "bg-slate-400"}`} title={ev.label} />
                    ))}
                    {cell.events.length > 4 && (
                      <span className="text-[8px] font-bold text-slate-400 dark:text-zinc-500">+{cell.events.length - 4}</span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <DaySideSheet date={selectedDay} onClose={() => setSelectedDay(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legend dot
// ---------------------------------------------------------------------------

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day Detail SideSheet
// ---------------------------------------------------------------------------

function DaySideSheet({ date: dateStr, onClose }: { date: string | null; onClose: () => void }) {
  const [data, setData] = useState<CalendarDayDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!dateStr) { setData(null); return; }
    setLoading(true);
    api.getCalendarDay(dateStr).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [dateStr]);

  const dateLabel = dateStr
    ? new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <SideSheet open={!!dateStr} onClose={onClose} title="Agenda do Dia">
      {loading || !data ? (
        <div className="flex h-40 items-center justify-center"><Loader2 size={20} className="animate-spin text-slate-300 dark:text-zinc-600" /></div>
      ) : (
        <div className="space-y-6 p-6">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100 capitalize">{dateLabel}</h2>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">{data.day_label}</p>
          </div>

          {/* Reservations */}
          {data.reservations.length > 0 && (
            <DaySection icon={CalendarDays} label="Reservas" color="text-orange-500 dark:text-orange-400">
              {data.reservations.map((r) => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-orange-100/60 bg-orange-50/30 p-3.5 dark:border-orange-500/10 dark:bg-orange-500/5">
                  <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{r.area_name.replace("_", " ")}</p>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-500"><MapPin size={10} strokeWidth={1.5} /> Apto {r.unit.number}</span>
                    {r.resident && <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-zinc-600"><User size={10} strokeWidth={1.5} /> {r.resident.full_name}</span>}
                  </div>
                </motion.div>
              ))}
            </DaySection>
          )}

          {/* Meetings */}
          {data.meetings.length > 0 && (
            <DaySection icon={Handshake} label="Reunioes" color="text-emerald-500 dark:text-emerald-400">
              {data.meetings.map((m) => (
                <motion.div key={m.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-emerald-100/60 bg-emerald-50/30 p-3.5 dark:border-emerald-500/10 dark:bg-emerald-500/5">
                  <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">{m.title}</p>
                  <div className="mt-1 flex items-center gap-3">
                    {m.meeting_time && <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-500"><Clock size={10} strokeWidth={1.5} /> {m.meeting_time}</span>}
                    {m.reason && <span className="text-[11px] text-slate-400 dark:text-zinc-600">{m.reason}</span>}
                  </div>
                </motion.div>
              ))}
            </DaySection>
          )}

          {/* Payables */}
          {data.payables.length > 0 && (
            <DaySection icon={CreditCard} label="Contas a Pagar" color="text-red-500 dark:text-red-400">
              {data.payables.map((p) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between rounded-xl border border-red-100/60 bg-red-50/30 p-3.5 dark:border-red-500/10 dark:bg-red-500/5">
                  <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">{p.description}</span>
                  <span className="text-sm font-bold text-red-600 dark:text-red-400">R$ {p.amount.toFixed(2)}</span>
                </motion.div>
              ))}
            </DaySection>
          )}

          {/* Tasks */}
          {data.tasks.length > 0 && (
            <DaySection icon={CheckCircle2} label="Tarefas" color="text-indigo-500 dark:text-indigo-400">
              {data.tasks.map((t) => (
                <motion.div key={t.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 rounded-xl border border-indigo-100/60 bg-indigo-50/30 p-3.5 dark:border-indigo-500/10 dark:bg-indigo-500/5">
                  <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] border-indigo-400 dark:border-indigo-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">{t.title}</span>
                </motion.div>
              ))}
            </DaySection>
          )}

          {data.reservations.length === 0 && data.meetings.length === 0 && data.payables.length === 0 && data.tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <CalendarDays size={32} strokeWidth={1} className="mb-3 text-slate-200 dark:text-zinc-700" />
              <p className="text-sm font-semibold text-slate-300 dark:text-zinc-600">Nenhum evento neste dia.</p>
            </div>
          )}
        </div>
      )}
    </SideSheet>
  );
}

function DaySection({ icon: Icon, label, color, children }: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string; color: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon size={13} strokeWidth={1.5} className={color} />
        <span className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${color}`}>{label}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
