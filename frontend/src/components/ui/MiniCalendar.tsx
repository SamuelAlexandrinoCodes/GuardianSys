import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const pad2 = (n: number) => String(n).padStart(2, "0");

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

interface MiniCalendarProps {
  value: string;
  onChange: (date: string) => void;
  className?: string;
}

export function MiniCalendar({ value, onChange, className = "" }: MiniCalendarProps) {
  const todayStr = useMemo(() => toDateStr(new Date()), []);

  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const [y, m] = value.split("-").map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date();
  });

  const { year, month, days, monthLabel } = useMemo(() => {
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const startPad = first.getDay();
    const totalDays = last.getDate();
    const cells: { day: number; dateStr: string; inMonth: boolean; isToday: boolean }[] = [];
    const prevMonth = new Date(y, m, 0);
    const prevDays = prevMonth.getDate();

    for (let i = 0; i < startPad; i++) {
      const d = prevDays - startPad + i + 1;
      const dDate = new Date(y, m - 1, d);
      cells.push({ day: d, dateStr: toDateStr(dDate), inMonth: false, isToday: toDateStr(dDate) === todayStr });
    }
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${y}-${pad2(m + 1)}-${pad2(d)}`;
      cells.push({ day: d, dateStr, inMonth: true, isToday: dateStr === todayStr });
    }
    const remaining = 42 - cells.length;
    for (let i = 0; i < remaining; i++) {
      const d = i + 1;
      const dDate = new Date(y, m + 1, d);
      cells.push({ day: d, dateStr: toDateStr(dDate), inMonth: false, isToday: toDateStr(dDate) === todayStr });
    }

    const monthLabel = viewDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return { year: y, month: m, days: cells, monthLabel };
  }, [viewDate, todayStr]);

  const goPrev = () => setViewDate(new Date(year, month - 1, 1));
  const goNext = () => setViewDate(new Date(year, month + 1, 1));

  return (
    <div className={`rounded-2xl border border-white/[0.06] bg-zinc-950/95 p-3 backdrop-blur-xl ${className}`}>
      {/* Navegação */}
      <div className="mb-2 flex items-center justify-between rounded-xl border border-white/[0.06] bg-zinc-900/80 px-1 py-1">
        <button
          type="button"
          onClick={goPrev}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={14} strokeWidth={1.5} />
        </button>
        <span className="text-xs font-bold text-zinc-100">{monthLabel}</span>
        <button
          type="button"
          onClick={goNext}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
          aria-label="Próximo mês"
        >
          <ChevronRight size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* Dias da semana */}
      <div className="grid grid-cols-7 gap-px pb-1">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid de dias — seleção única: apenas data selecionada = círculo branco; hoje = contorno sutil */}
      <div className="grid grid-cols-7 gap-px">
        {days.map((cell) => {
          const isSelected = value === cell.dateStr;
          const isToday = cell.isToday && !isSelected;
          return (
            <button
              key={`${cell.dateStr}-${cell.day}`}
              type="button"
              disabled={!cell.inMonth}
              onClick={() => cell.inMonth && onChange(cell.dateStr)}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                !cell.inMonth
                  ? "text-zinc-600"
                  : isSelected
                    ? "bg-white text-zinc-900"
                    : isToday
                      ? "text-zinc-100 ring-1 ring-zinc-500/50 ring-inset hover:bg-white/5"
                      : "text-zinc-100 hover:bg-white/10"
              }`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
