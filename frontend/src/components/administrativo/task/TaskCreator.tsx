import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as ColorPopover from "@radix-ui/react-popover";
import {
  Plus,
  CalendarDays,
  Bell,
  Repeat,
  Calendar,
  Clock,
  Sun,
  Zap,
  Trash2,
} from "lucide-react";
import { api } from "../../../lib/api";
import { MiniCalendar } from "../../ui/MiniCalendar";
import { Time24Input } from "../../ui/Time24Input";
import {
  parseSmartInput,
  isReminderInPast,
  emptyMeta,
  type QuickMeta,
  type TaskFilterValue,
  repeatOptions,
  pad2,
} from "./helpers/taskHelpers";

/* ========================================================================== */
/* StaticActionButton                                                         */
/* ========================================================================== */

function StaticActionButton({
  icon: Icon,
  label,
  active,
  className = "",
  onHoverChange,
  ...props
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  active?: boolean;
  className?: string;
  onHoverChange?: (hovered: boolean) => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onMouseEnter={() => onHoverChange?.(true)}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg backdrop-blur transition-colors ${className} ${
        active
          ? "bg-indigo-50/80 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
          : "bg-slate-50/50 text-slate-500 dark:bg-white/5 dark:text-zinc-400 hover:bg-slate-100/80 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-zinc-300"
      }`}
      aria-label={label}
      {...props}
    >
      <Icon size={14} strokeWidth={1.5} />
    </button>
  );
}

/* ========================================================================== */
/* TaskCreator                                                                */
/* ========================================================================== */

export interface TaskCreatorProps {
  taskFilter: TaskFilterValue;
  onRefresh: () => void;
  onTaskCreated?: (taskId: number) => void;
}

export function TaskCreator({ taskFilter, onRefresh, onTaskCreated }: TaskCreatorProps) {
  const [quickInput, setQuickInput] = useState("");
  const [quickMeta, setQuickMeta] = useState<QuickMeta>(emptyMeta);
  const [activePopover, setActivePopover] = useState<
    "start" | "due" | "reminder" | "repeat" | null
  >(null);
  const [hoveredQuickAction, setHoveredQuickAction] = useState<
    "start" | "due" | "reminder" | "repeat" | null
  >(null);
  const [showManualDelivery, setShowManualDelivery] = useState(false);
  const [showManualReminder, setShowManualReminder] = useState(false);
  const [reminderExpiredFeedback, setReminderExpiredFeedback] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const mainInputContainerRef = useRef<HTMLDivElement>(null);
  const buttonGroupRef = useRef<HTMLDivElement>(null);

  const smartParsed = quickInput.trim()
    ? parseSmartInput(quickInput)
    : { title: "", reminderAt: null, dueDate: null };
  const hasSmartReminder = !!smartParsed.reminderAt;
  const hasSmartDate = !!smartParsed.dueDate && !hasSmartReminder;

  const todayStr = new Date().toISOString().split("T")[0];

  const dueDatePresets = (() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const nextMon = new Date(tomorrow);
    while (nextMon.getDay() !== 1) nextMon.setDate(nextMon.getDate() + 1);
    const nextMonStr = nextMon.toISOString().split("T")[0];
    const fmt = (d: Date) =>
      d
        .toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })
        .replace(".", "");
    return [
      { id: "today" as const, label: "Hoje", date: todayStr, sub: fmt(now) },
      { id: "tomorrow" as const, label: "Amanhã", date: tomorrowStr, sub: fmt(tomorrow) },
      {
        id: "nextweek" as const,
        label: "Próxima Semana",
        date: nextMonStr,
        sub: fmt(nextMon),
      },
    ];
  })();

  const reminderPresets = (() => {
    const now = new Date();
    const later = new Date(now);
    if (later.getMinutes() >= 30) {
      later.setHours(later.getHours() + 1, 0, 0, 0);
    } else {
      later.setMinutes(30, 0, 0);
    }
    const laterTime = `${pad2(later.getHours())}:${pad2(later.getMinutes())}`;
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const nextMon = new Date(tomorrow);
    while (nextMon.getDay() !== 1) nextMon.setDate(nextMon.getDate() + 1);
    nextMon.setHours(9, 0, 0, 0);
    const nextMonStr = nextMon.toISOString().split("T")[0];
    const fmt = (d: Date) =>
      d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
    return [
      {
        id: "later" as const,
        label: "Mais tarde hoje",
        sub: laterTime,
        icon: Clock,
        date: todayStr,
        time: laterTime,
      },
      {
        id: "tomorrow" as const,
        label: "Amanhã",
        sub: `${fmt(tomorrow)}, 09:00`,
        icon: Sun,
        date: tomorrowStr,
        time: "09:00",
      },
      {
        id: "nextweek" as const,
        label: "Próxima semana",
        sub: `${fmt(nextMon)}, 09:00`,
        icon: Calendar,
        date: nextMonStr,
        time: "09:00",
      },
    ];
  })();

  useEffect(() => {
    const { reminderDate, reminderTime } = quickMeta;
    if (
      reminderDate &&
      reminderTime &&
      isReminderInPast(reminderDate, reminderTime)
    ) {
      setQuickMeta((prev) => ({ ...prev, reminderDate: "", reminderTime: "" }));
      setReminderExpiredFeedback(true);
      const t = setTimeout(() => setReminderExpiredFeedback(false), 3000);
      return () => clearTimeout(t);
    }
  }, [quickMeta.reminderDate, quickMeta.reminderTime]);

  useEffect(() => {
    if (activePopover === "start") {
      setQuickMeta((prev) => {
        if (prev.startDate) return prev;
        const today = new Date().toISOString().split("T")[0];
        return { ...prev, startDate: today };
      });
    }
  }, [activePopover]);

  const handleQuickCreate = useCallback(async () => {
    const raw = quickInput.trim();
    if (!raw) return;

    const { title, reminderAt, dueDate } = parseSmartInput(raw);
    const payload: Record<string, unknown> = { title: title || raw };

    if (quickMeta.dueDate) {
      payload.due_date = quickMeta.dueDate;
    } else if (dueDate) {
      payload.due_date = dueDate.split("T")[0];
    }
    if (taskFilter === "meu_dia") {
      payload.start_date = quickMeta.startDate || todayStr;
    } else if (taskFilter === "planejado") {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      payload.start_date =
        quickMeta.startDate || tomorrow.toISOString().split("T")[0];
    } else {
      payload.start_date = quickMeta.startDate || null;
    }
    if (taskFilter === "importante") {
      payload.is_important = true;
    }
    if (taskFilter === "planejado") {
      payload.is_assigned = true;
    }
    if (taskFilter.startsWith("list:")) {
      const listId = parseInt(taskFilter.split(":")[1] || "0", 10);
      if (listId) payload.list_id = listId;
    }

    if (quickMeta.reminderDate && quickMeta.reminderTime) {
      if (!isReminderInPast(quickMeta.reminderDate, quickMeta.reminderTime)) {
        payload.reminder_at = `${quickMeta.reminderDate}T${quickMeta.reminderTime}`;
      }
    } else if (reminderAt) {
      const [d, t] = reminderAt.split("T");
      const timePart = t?.slice(0, 5) || "00:00";
      if (!isReminderInPast(d || "", timePart)) {
        payload.reminder_at = reminderAt;
      }
    }

    if (quickMeta.repeat !== "NONE") {
      payload.repeat = quickMeta.repeat;
      if (quickMeta.repeat === "CUSTOM" && quickMeta.repeatDays) {
        payload.repeat_interval_days = quickMeta.repeatDays;
      }
    }

    setQuickInput("");
    setQuickMeta(emptyMeta);
    setActivePopover(null);
    const created = await api.createTask(payload);
    onRefresh();
    onTaskCreated?.(created.id);
  }, [quickInput, quickMeta, taskFilter, onRefresh, onTaskCreated, todayStr]);

  const hasStartDate = !!quickMeta.startDate;
  const hasDate = !!quickMeta.dueDate;
  const hasReminder = !!(quickMeta.reminderDate && quickMeta.reminderTime);
  const hasRepeat = quickMeta.repeat !== "NONE";

  return (
    <ColorPopover.Root
      modal={false}
      open={activePopover !== null}
      onOpenChange={(open) => {
        if (!open) {
          setActivePopover(null);
          setShowManualDelivery(false);
          setShowManualReminder(false);
        }
      }}
    >
      <ColorPopover.Anchor asChild>
        <div
          ref={mainInputContainerRef}
          className="rounded-2xl border border-slate-200/60 bg-white shadow-sm transition-shadow focus-within:shadow-md dark:border-white/[0.06] dark:bg-zinc-900"
        >
          <div className="flex h-12 min-h-12 items-center gap-2 px-4 py-2">
            <Plus
              size={14}
              strokeWidth={1.5}
              className="shrink-0 text-slate-300 dark:text-zinc-600"
            />
            <input
              ref={inputRef}
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuickCreate()}
              placeholder="Nova tarefa...  (ex: Comprar pao lembrete em 10 min)"
              className="flex-1 min-w-0 bg-transparent text-[14px] font-semibold tracking-tight text-slate-900 placeholder-slate-300 outline-none dark:text-zinc-100 dark:placeholder-zinc-600"
            />
            <AnimatePresence>
              {quickInput.length > 0 && (
                <motion.div
                  ref={buttonGroupRef}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  className="relative flex items-center gap-1"
                  onMouseLeave={() => setHoveredQuickAction(null)}
                >
                  <StaticActionButton
                    icon={Zap}
                    label="Data de Início"
                    active={hasStartDate}
                    onHoverChange={(h) => h && setHoveredQuickAction("start")}
                    onClick={() =>
                      setActivePopover(activePopover === "start" ? null : "start")
                    }
                    className={
                      hasStartDate
                        ? "!bg-indigo-50/80 !text-indigo-600 dark:!bg-indigo-500/10 dark:!text-indigo-400"
                        : ""
                    }
                  />
                  <StaticActionButton
                    icon={CalendarDays}
                    label="Data de Entrega"
                    active={hasDate}
                    onHoverChange={(h) => h && setHoveredQuickAction("due")}
                    onClick={() =>
                      setActivePopover(activePopover === "due" ? null : "due")
                    }
                    className={
                      hasDate
                        ? "!bg-indigo-50/80 !text-indigo-600 dark:!bg-indigo-500/10 dark:!text-indigo-400"
                        : ""
                    }
                  />
                  <StaticActionButton
                    icon={Bell}
                    label="Lembrete"
                    active={hasReminder}
                    onHoverChange={(h) => h && setHoveredQuickAction("reminder")}
                    onClick={() =>
                      setActivePopover(
                        activePopover === "reminder" ? null : "reminder"
                      )
                    }
                    className={
                      hasReminder
                        ? "!bg-blue-50/80 !text-blue-600 dark:!bg-blue-500/10 dark:!text-blue-400"
                        : ""
                    }
                  />
                  <StaticActionButton
                    icon={Repeat}
                    label="Repetir"
                    active={hasRepeat}
                    onHoverChange={(h) => h && setHoveredQuickAction("repeat")}
                    onClick={() =>
                      setActivePopover(
                        activePopover === "repeat" ? null : "repeat"
                      )
                    }
                    className={
                      hasRepeat
                        ? "!bg-orange-50/80 !text-orange-600 dark:!bg-orange-500/10 dark:!text-orange-400"
                        : ""
                    }
                  />

                  {hoveredQuickAction && (
                    <div className="absolute bottom-full left-0 right-0 z-10 mb-1 flex w-full items-center justify-center rounded-lg bg-slate-800 py-1.5 text-[11px] font-medium text-white shadow-lg dark:bg-zinc-700">
                      {hoveredQuickAction === "start" && "Data de Início"}
                      {hoveredQuickAction === "due" && "Data de Entrega"}
                      {hoveredQuickAction === "reminder" && "Lembrete"}
                      {hoveredQuickAction === "repeat" && "Repetir"}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {(hasSmartReminder || hasSmartDate) && (
            <div className="flex gap-2 px-4 pb-3">
              {hasSmartReminder && (
                <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                  <Bell size={10} strokeWidth={2} />
                  Lembrete:{" "}
                  {new Date(
                    smartParsed.reminderAt!
                  ).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
              {hasSmartDate && (
                <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                  <CalendarDays size={10} strokeWidth={2} />
                  Data sugerida:{" "}
                  {new Date(
                    smartParsed.dueDate!
                  ).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
              )}
            </div>
          )}
        </div>
      </ColorPopover.Anchor>

      <ColorPopover.Portal>
        <ColorPopover.Content
          side="bottom"
          align="end"
          sideOffset={10}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="z-[9999] min-w-[200px] max-w-[320px] rounded-3xl border border-slate-200/40 bg-white/80 p-5 shadow-2xl shadow-slate-200/50 backdrop-blur-xl dark:border-white/[0.06] dark:bg-zinc-900/80 dark:shadow-none"
          onClick={(e) => e.stopPropagation()}
        >
          {activePopover === "start" && (
            <div className="space-y-3">
              <div className="mb-2 flex items-center gap-2">
                <Zap size={14} strokeWidth={1.5} className="text-indigo-500" />
                <span className="text-xs font-bold tracking-tight text-slate-800 dark:text-zinc-200">
                  Data de Início
                </span>
              </div>
              <MiniCalendar
                value={quickMeta.startDate}
                onChange={(v) => {
                  setQuickMeta({ ...quickMeta, startDate: v });
                  setActivePopover(null);
                }}
              />
            </div>
          )}

          {activePopover === "due" && (
            <div className="space-y-3">
              <div className="mb-3 flex items-center gap-2">
                <CalendarDays
                  size={14}
                  strokeWidth={1.5}
                  className="text-indigo-500"
                />
                <span className="text-xs font-bold tracking-tight text-slate-800 dark:text-zinc-200">
                  Data de Entrega
                </span>
              </div>
              {!showManualDelivery ? (
                <>
                  <div className="flex flex-col gap-1">
                    {dueDatePresets.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setQuickMeta({ ...quickMeta, dueDate: p.date });
                          setActivePopover(null);
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                      >
                        <span>{p.label}</span>
                        <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500">
                          {p.sub}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="my-1 border-t border-slate-100 dark:border-white/[0.04]" />
                  <button
                    type="button"
                    onClick={() => setShowManualDelivery(true)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                  >
                    <Calendar
                      size={16}
                      strokeWidth={1.5}
                      className="shrink-0 text-indigo-500"
                    />
                    Escolher data
                  </button>
                </>
              ) : (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                      Escolher data
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowManualDelivery(false)}
                      className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
                    >
                      Voltar
                    </button>
                  </div>
                  <MiniCalendar
                    value={quickMeta.dueDate}
                    onChange={(v) => {
                      setQuickMeta({ ...quickMeta, dueDate: v });
                      setActivePopover(null);
                    }}
                  />
                  {quickMeta.dueDate && (
                    <button
                      type="button"
                      onClick={() => setQuickMeta({ ...quickMeta, dueDate: "" })}
                      className="mt-2 text-[11px] font-semibold text-red-400 transition-colors hover:text-red-500"
                    >
                      Limpar
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {activePopover === "reminder" && (
            <div className="space-y-3">
              {reminderExpiredFeedback && (
                <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  Lembrete expirado, removido.
                </p>
              )}
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold tracking-tight text-slate-800 dark:text-zinc-200">
                  Lembrete
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setQuickMeta({
                      ...quickMeta,
                      reminderDate: "",
                      reminderTime: "",
                    });
                    setActivePopover(null);
                  }}
                  className="flex items-center gap-1 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-500 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                  title="Remover lembrete"
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              </div>
              {!showManualReminder ? (
                <>
                  <div className="flex flex-col gap-1">
                    {reminderPresets.map((p) => {
                      const Icon = p.icon;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setQuickMeta({
                              ...quickMeta,
                              reminderDate: p.date,
                              reminderTime: p.time,
                            });
                            setActivePopover(null);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                        >
                          <Icon
                            size={16}
                            strokeWidth={1.5}
                            className="shrink-0 text-blue-500"
                          />
                          <span className="flex-1">{p.label}</span>
                          <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500">
                            {p.sub}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="my-1 border-t border-slate-100 dark:border-white/[0.04]" />
                  <button
                    type="button"
                    onClick={() => setShowManualReminder(true)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                  >
                    <Calendar
                      size={16}
                      strokeWidth={1.5}
                      className="shrink-0 text-blue-500"
                    />
                    Escolher data e hora
                  </button>
                </>
              ) : (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold tracking-tight text-slate-800 dark:text-zinc-200">
                      Escolher data e hora
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowManualReminder(false)}
                      className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
                    >
                      Voltar
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                      Data
                    </label>
                    <MiniCalendar
                      value={quickMeta.reminderDate}
                      onChange={(v) => {
                        setQuickMeta({ ...quickMeta, reminderDate: v });
                        setActivePopover(null);
                      }}
                    />
                  </div>
                  <div className="space-y-1" data-no-dnd="true">
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                      Horário (24h)
                    </label>
                    <Time24Input
                      value={quickMeta.reminderTime}
                      onChange={(v) =>
                        setQuickMeta({ ...quickMeta, reminderTime: v })
                      }
                      onKeyDown={(e) => e.stopPropagation()}
                      className="w-full rounded-xl border border-slate-200/60 bg-white/60 px-3 py-2.5 text-center text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 dark:border-white/[0.08] dark:bg-zinc-800/60 dark:text-zinc-300"
                    />
                  </div>
                  {(quickMeta.reminderDate || quickMeta.reminderTime) && (
                    <button
                      type="button"
                      onClick={() =>
                        setQuickMeta({
                          ...quickMeta,
                          reminderDate: "",
                          reminderTime: "",
                        })
                      }
                      className="text-[11px] font-semibold text-red-400 transition-colors hover:text-red-500"
                    >
                      Limpar lembrete
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {activePopover === "repeat" && (
            <div className="space-y-1">
              {repeatOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = quickMeta.repeat === opt.value;
                const isCustom = opt.value === "CUSTOM";
                return (
                  <div key={opt.value}>
                    <button
                      type="button"
                      onClick={() =>
                        setQuickMeta({
                          ...quickMeta,
                          repeat: opt.value,
                          ...(opt.value !== "CUSTOM"
                            ? { repeatDays: "" as const }
                            : {}),
                        })
                      }
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                        isSelected
                          ? "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
                          : "text-slate-700 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <Icon
                        size={14}
                        strokeWidth={1.5}
                        className={
                          isSelected
                            ? "text-orange-500"
                            : "text-slate-400 dark:text-zinc-500"
                        }
                      />
                      {opt.label}
                    </button>
                    {isCustom && isSelected && (
                      <div className="ml-6 mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={
                            quickMeta.repeatDays === "" ? "" : quickMeta.repeatDays
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            setQuickMeta({
                              ...quickMeta,
                              repeatDays:
                                val === "" ? "" : parseInt(val, 10) || 1,
                            });
                          }}
                          placeholder="7"
                          onClick={(e) => e.stopPropagation()}
                          className="w-20 rounded-lg border border-slate-200/60 bg-white/60 px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/30 dark:border-white/[0.08] dark:bg-zinc-800/60 dark:text-zinc-300"
                        />
                        <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500">
                          dias
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              {quickMeta.repeat !== "NONE" && (
                <button
                  type="button"
                  onClick={() =>
                    setQuickMeta({
                      ...quickMeta,
                      repeat: "NONE",
                      repeatDays: "",
                    })
                  }
                  className="mt-3 text-[11px] font-semibold text-red-400 transition-colors hover:text-red-500"
                >
                  Limpar repetição
                </button>
              )}
            </div>
          )}
        </ColorPopover.Content>
      </ColorPopover.Portal>
    </ColorPopover.Root>
  );
}
