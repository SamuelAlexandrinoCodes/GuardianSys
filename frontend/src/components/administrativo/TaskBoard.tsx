import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as ColorPopover from "@radix-ui/react-popover";
import { pt as chronoPt } from "chrono-node";
import {
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
  Trash2,
  CalendarDays,
  Bell,
  Repeat,
  History,
  Sparkles,
  Palette,
  X,
  Search,
  Calendar,
  Hash,
  CircleSlash,
  Clock,
  Sun,
  Zap,
} from "lucide-react";
import type { Task, TaskStep } from "../../types";
import { api } from "../../lib/api";
import { TaskSideSheet } from "./TaskSideSheet";
import { MiniCalendar } from "../ui/MiniCalendar";
import { Time24Input } from "../ui/Time24Input";

/* ========================================================================== */
/* Constants                                                                  */
/* ========================================================================== */

const colorHexMap: Record<string, string> = {
  "border-l-red-500": "#ef4444",
  "border-l-orange-500": "#f97316",
  "border-l-emerald-500": "#10b981",
  "border-l-blue-500": "#3b82f6",
  "border-l-purple-500": "#a855f7",
};

const colorOptions = [
  { value: "border-l-red-500", bg: "bg-red-500" },
  { value: "border-l-orange-500", bg: "bg-orange-500" },
  { value: "border-l-emerald-500", bg: "bg-emerald-500" },
  { value: "border-l-blue-500", bg: "bg-blue-500" },
  { value: "border-l-purple-500", bg: "bg-purple-500" },
];

/* ========================================================================== */
/* Quick Action Button + Tooltip — estático, ícone centralizado                */
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
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl backdrop-blur transition-colors ${className} ${
        active
          ? "bg-indigo-50/80 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
          : "bg-slate-50/50 text-slate-500 dark:bg-white/5 dark:text-zinc-400 hover:bg-slate-100/80 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-zinc-300"
      }`}
      aria-label={label}
      {...props}
    >
      <Icon size={16} strokeWidth={1.5} />
    </button>
  );
}

const repeatOptions: { value: string; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }> }[] = [
  { value: "NONE", label: "Não repete", icon: CircleSlash },
  { value: "DAILY", label: "Diariamente", icon: Repeat },
  { value: "WEEKLY", label: "Semanalmente", icon: Calendar },
  { value: "MONTHLY", label: "Mensalmente", icon: CalendarDays },
  { value: "CUSTOM", label: "A cada X dias", icon: Hash },
];

/* ========================================================================== */
/* Smart Reminder Parser (chrono-node + Híbrido)                              */
/* ========================================================================== */

const pad2 = (n: number) => String(n).padStart(2, "0");

function fmtLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function parseSmartInput(raw: string): {
  title: string;
  reminderAt: string | null;
  dueDate: string | null;
} {
  const result = { title: raw, reminderAt: null as string | null, dueDate: null as string | null };

  // 1. Lembrete Explícito (Corta o texto)
  const reminderRegex = /\s*(?:lembrete|me lembre|lembrar)\s+(.+)$/i;
  const reminderMatch = raw.match(reminderRegex);

  if (reminderMatch) {
    result.title = raw.slice(0, reminderMatch.index).trim();
    const temporalStr = reminderMatch[1]
      .replace(/\bmin\b/gi, "minutos")
      .replace(/\bhr?s?\b/gi, "horas");

    // Lógica cravada de alta precisão para "em X minutos/horas"
    const relativeMatch = temporalStr.match(/^(?:em\s+|daqui a\s+)?(\d+)\s*(minuto|minutos|min|m|hora|horas|h|hr)$/i);
    if (relativeMatch) {
      const amount = parseInt(relativeMatch[1], 10);
      const unit = relativeMatch[2].toLowerCase();
      const d = new Date();
      if (unit.startsWith("h")) d.setHours(d.getHours() + amount);
      else d.setMinutes(d.getMinutes() + amount);
      result.reminderAt = fmtLocal(d);
    } else {
      const parsed = chronoPt.parseDate(temporalStr, new Date(), { forwardDate: true });
      if (parsed) result.reminderAt = fmtLocal(parsed);
    }
  } else {
    // 2. Data Comum (Não corta o texto, apenas detecta para due_date)
    const parsedResults = chronoPt.parse(raw, new Date(), { forwardDate: true });
    if (parsedResults.length > 0) {
      result.dueDate = fmtLocal(parsedResults[0].start.date());
    }
  }

  return result;
}

/* ========================================================================== */
/* Quick Action Meta                                                          */
/* ========================================================================== */

interface QuickMeta {
  startDate: string;
  dueDate: string;
  reminderDate: string;
  reminderTime: string;
  repeat: string;
  repeatDays: number | "";
}

const emptyMeta: QuickMeta = {
  startDate: "",
  dueDate: "",
  reminderDate: "",
  reminderTime: "",
  repeat: "NONE",
  repeatDays: "",
};

/* ========================================================================== */
/* Props                                                                      */
/* ========================================================================== */

interface TaskBoardProps {
  pending: Task[];
  completed: Task[];
  onRefresh: () => void;
}

/* ========================================================================== */
/* TaskBoard                                                                  */
/* ========================================================================== */

export function TaskBoard({ pending, completed, onRefresh }: TaskBoardProps) {
  const [quickInput, setQuickInput] = useState("");
  const [quickMeta, setQuickMeta] = useState<QuickMeta>(emptyMeta);
  const [activePopover, setActivePopover] = useState<
    "start" | "due" | "reminder" | "repeat" | null
  >(null);
  const [hoveredQuickAction, setHoveredQuickAction] = useState<"start" | "due" | "reminder" | "repeat" | null>(null);
  const [showManualDelivery, setShowManualDelivery] = useState(false);
  const [showManualReminder, setShowManualReminder] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // --- MÁGICA EM TEMPO REAL (O Erro vermelho foi resolvido aqui) ---
  const smartParsed = quickInput.trim() ? parseSmartInput(quickInput) : { title: "", reminderAt: null, dueDate: null };
  const hasSmartReminder = !!smartParsed.reminderAt;
  const hasSmartDate = !!smartParsed.dueDate && !hasSmartReminder;

  const inputRef = useRef<HTMLInputElement>(null);
  const mainInputContainerRef = useRef<HTMLDivElement>(null);
  const buttonGroupRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );

  useEffect(() => {
    if (!activeTask) return;
    const id = activeTask.id;
    const updated = [...pending, ...completed].find((t) => t.id === id);
    if (updated) setActiveTask(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, completed]);

  // Data de início: auto-selecionar hoje ao abrir o popover
  useEffect(() => {
    if (activePopover === "start") {
      setQuickMeta((prev) => {
        if (prev.startDate) return prev;
        const today = new Date().toISOString().split("T")[0];
        return { ...prev, startDate: today };
      });
    }
  }, [activePopover]);

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
    const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).replace(".", "");
    return [
      { id: "today" as const, label: "Hoje", date: todayStr, sub: fmt(now) },
      { id: "tomorrow" as const, label: "Amanhã", date: tomorrowStr, sub: fmt(tomorrow) },
      { id: "nextweek" as const, label: "Próxima Semana", date: nextMonStr, sub: fmt(nextMon) },
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
    const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
    return [
      { id: "later" as const, label: "Mais tarde hoje", sub: laterTime, icon: Clock, date: todayStr, time: laterTime },
      { id: "tomorrow" as const, label: "Amanhã", sub: `${fmt(tomorrow)}, 09:00`, icon: Sun, date: tomorrowStr, time: "09:00" },
      { id: "nextweek" as const, label: "Próxima semana", sub: `${fmt(nextMon)}, 09:00`, icon: Calendar, date: nextMonStr, time: "09:00" },
    ];
  })();

  const todayCompleted = completed.filter(
    (t) => t.completed_at && t.completed_at.startsWith(todayStr)
  );

  /* ---- Handlers ---- */

  const handleQuickCreate = useCallback(async () => {
    const raw = quickInput.trim();
    if (!raw) return;

    const { title, reminderAt, dueDate } = parseSmartInput(raw);
    const payload: Record<string, unknown> = { title: title || raw };

    // Prioridade 1: Botões Manuais. Prioridade 2: Inteligência do texto.
    if (quickMeta.dueDate) {
      payload.due_date = quickMeta.dueDate;
    } else if (dueDate) {
      payload.due_date = dueDate.split("T")[0];
    }
    // Data de início: usa valor selecionado ou hoje como padrão
    payload.start_date = quickMeta.startDate || todayStr;

    if (quickMeta.reminderDate && quickMeta.reminderTime) {
      payload.reminder_at = `${quickMeta.reminderDate}T${quickMeta.reminderTime}`;
    } else if (reminderAt) {
      payload.reminder_at = reminderAt;
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
    await api.createTask(payload);
    onRefresh();
  }, [quickInput, quickMeta, onRefresh, todayStr]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIdx = pending.findIndex((t) => t.id === active.id);
      const newIdx = pending.findIndex((t) => t.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;

      const reordered = arrayMove(pending, oldIdx, newIdx);
      api.reorderTasks(reordered.map((t) => t.id));
      onRefresh();
    },
    [pending, onRefresh]
  );

  const handleToggle = useCallback(
    async (task: Task) => {
      await api.toggleTask(task.id);
      onRefresh();
    },
    [onRefresh]
  );

  const handleDelete = useCallback(
    async (taskId: number) => {
      await api.deleteTask(taskId);
      if (activeTask?.id === taskId) setActiveTask(null);
      onRefresh();
    },
    [activeTask, onRefresh]
  );

  const handleAddStep = useCallback(
    async (task: Task, title: string) => {
      await api.addStep(task.id, title);
      onRefresh();
    },
    [onRefresh]
  );

  const handleToggleStep = useCallback(
    async (task: Task, step: TaskStep) => {
      await api.toggleStep(task.id, step.id);
      onRefresh();
    },
    [onRefresh]
  );

  const handleDeleteStep = useCallback(
    async (task: Task, stepId: number) => {
      await api.deleteStep(task.id, stepId);
      onRefresh();
    },
    [onRefresh]
  );

  const handleColorChange = useCallback(
    async (taskId: number, color: string | null) => {
      await api.updateTask(taskId, { color });
      onRefresh();
    },
    [onRefresh]
  );

  const hasStartDate = !!quickMeta.startDate;
  const hasDate = !!quickMeta.dueDate;
  const hasReminder = !!(quickMeta.reminderDate && quickMeta.reminderTime);
  const hasRepeat = quickMeta.repeat !== "NONE";

  return (
    <>
      <div className="flex h-full flex-col">
        {/* ---------------------------------------------------------------- */}
        {/* Quick-add input — hierarquia dupla (tooltips vs popovers)          */}
        {/* ---------------------------------------------------------------- */}
        <div className="shrink-0 px-6 pt-6 pb-4">
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
            <div className="flex items-center gap-3 px-4 py-3.5">
              <Plus
                size={16}
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
                className="flex-1 min-w-0 bg-transparent text-[15px] font-semibold tracking-tight text-slate-900 placeholder-slate-300 outline-none dark:text-zinc-100 dark:placeholder-zinc-600"
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
              {/* Início */}
              <StaticActionButton
                icon={Zap}
                label="Data de Início"
                active={hasStartDate}
                onHoverChange={(h) => h && setHoveredQuickAction("start")}
                onClick={() => setActivePopover(activePopover === "start" ? null : "start")}
                className={hasStartDate ? "!bg-indigo-50/80 !text-indigo-600 dark:!bg-indigo-500/10 dark:!text-indigo-400" : ""}
              />
              {/* Entrega */}
              <StaticActionButton
                icon={CalendarDays}
                label="Data de Entrega"
                active={hasDate}
                onHoverChange={(h) => h && setHoveredQuickAction("due")}
                onClick={() => setActivePopover(activePopover === "due" ? null : "due")}
                className={hasDate ? "!bg-indigo-50/80 !text-indigo-600 dark:!bg-indigo-500/10 dark:!text-indigo-400" : ""}
              />
              {/* Lembrete */}
              <StaticActionButton
                icon={Bell}
                label="Lembrete"
                active={hasReminder}
                onHoverChange={(h) => h && setHoveredQuickAction("reminder")}
                onClick={() => setActivePopover(activePopover === "reminder" ? null : "reminder")}
                className={hasReminder ? "!bg-blue-50/80 !text-blue-600 dark:!bg-blue-500/10 dark:!text-blue-400" : ""}
              />
              {/* Repetir */}
              <StaticActionButton
                icon={Repeat}
                label="Repetir"
                active={hasRepeat}
                onHoverChange={(h) => h && setHoveredQuickAction("repeat")}
                onClick={() => setActivePopover(activePopover === "repeat" ? null : "repeat")}
                className={hasRepeat ? "!bg-orange-50/80 !text-orange-600 dark:!bg-orange-500/10 dark:!text-orange-400" : ""}
              />

              {/* Tooltip — acima dos botões (side: top), largura exata do buttonGroupRef */}
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

            {/* Smart Pills (Realtime NLP feedback) */}
            {(hasSmartReminder || hasSmartDate) && (
              <div className="flex gap-2 px-4 pb-3">
                {hasSmartReminder && (
                  <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                    <Bell size={10} strokeWidth={2} />
                    Lembrete: {new Date(smartParsed.reminderAt!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
                {hasSmartDate && (
                  <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                    <CalendarDays size={10} strokeWidth={2} />
                    Data sugerida: {new Date(smartParsed.dueDate!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
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
                {/* Início — Data de Início (padrão: hoje, sem botão Limpar) */}
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

                {/* Entrega — presets primeiro; "Escolher data" revela MiniCalendar */}
                {activePopover === "due" && (
                  <div className="space-y-3">
                    <div className="mb-3 flex items-center gap-2">
                      <CalendarDays size={14} strokeWidth={1.5} className="text-indigo-500" />
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
                              <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500">{p.sub}</span>
                            </button>
                          ))}
                        </div>
                        <div className="my-1 border-t border-slate-100 dark:border-white/[0.04]" />
                        <button
                          type="button"
                          onClick={() => setShowManualDelivery(true)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                        >
                          <Calendar size={16} strokeWidth={1.5} className="shrink-0 text-indigo-500" />
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

                {/* Lembrete — presets primeiro; "Escolher data e hora" revela MiniCalendar + Horário */}
                {activePopover === "reminder" && (
                  <div className="space-y-3">
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
                                <Icon size={16} strokeWidth={1.5} className="shrink-0 text-blue-500" />
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
                          <Calendar size={16} strokeWidth={1.5} className="shrink-0 text-blue-500" />
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

                {/* Repetir */}
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
                                  ...(opt.value !== "CUSTOM" ? { repeatDays: "" as const } : {}),
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
                                className={isSelected ? "text-orange-500" : "text-slate-400 dark:text-zinc-500"}
                              />
                              {opt.label}
                            </button>
                            {isCustom && isSelected && (
                              <div className="ml-6 mt-2 flex items-center gap-2">
                                <input
                                  type="number"
                                  min={1}
                                  value={quickMeta.repeatDays === "" ? "" : quickMeta.repeatDays}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setQuickMeta({
                                      ...quickMeta,
                                      repeatDays: val === "" ? "" : parseInt(val, 10) || 1,
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
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Pending tasks — sortable via press-to-drag                       */}
        {/* ---------------------------------------------------------------- */}
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none px-6 pb-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={pending.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {pending.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={() => handleToggle(task)}
                  onDelete={() => handleDelete(task.id)}
                  onClick={() => setActiveTask(task)}
                  onAddStep={handleAddStep}
                  onToggleStep={handleToggleStep}
                  onDeleteStep={handleDeleteStep}
                  onColorChange={(color) =>
                    handleColorChange(task.id, color)
                  }
                />
              ))}
            </SortableContext>
          </DndContext>

          {pending.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <Sparkles
                size={40}
                strokeWidth={1}
                className="mb-4 text-slate-200 dark:text-zinc-700"
              />
              <p className="text-sm font-bold tracking-tight text-slate-300 dark:text-zinc-600">
                Comando limpo.
              </p>
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Completed dock                                                   */}
        {/* ---------------------------------------------------------------- */}
        <div className="shrink-0 border-t border-slate-200/60 bg-white dark:border-white/[0.06] dark:bg-zinc-900">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex w-full items-center justify-between px-6 py-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
                Concluidas
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
                {todayCompleted.length}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 transition-colors hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-400"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowHistory(true);
                }}
              >
                <History size={11} strokeWidth={1.5} />
                Historico
              </button>
              {showCompleted ? (
                <ChevronUp
                  size={14}
                  className="text-slate-300 dark:text-zinc-600"
                />
              ) : (
                <ChevronDown
                  size={14}
                  className="text-slate-300 dark:text-zinc-600"
                />
              )}
            </div>
          </button>

          <AnimatePresence>
            {showCompleted && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="max-h-[30vh] space-y-1 overflow-y-auto scrollbar-none px-6 pb-4">
                  {todayCompleted.map((task) => (
                    <CompletedRow
                      key={task.id}
                      task={task}
                      onToggle={() => handleToggle(task)}
                      onDelete={() => handleDelete(task.id)}
                    />
                  ))}
                  {todayCompleted.length === 0 && (
                    <p className="py-4 text-center text-xs font-medium text-slate-300 dark:text-zinc-600">
                      Nenhuma tarefa finalizada hoje.
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <TaskSideSheet
        task={activeTask}
        onClose={() => setActiveTask(null)}
        onRefresh={onRefresh}
        onColorChange={handleColorChange}
      />

      <HistoryOverlay
        open={showHistory}
        onClose={() => setShowHistory(false)}
        completed={completed}
        onToggle={handleToggle}
        onDelete={handleDelete}
      />
    </>
  );
}

/* ========================================================================== */
/* TaskRow — sortable card (press-to-drag, no grip icon)                      */
/* ========================================================================== */

interface TaskRowProps {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onClick: () => void;
  onAddStep: (task: Task, title: string) => void;
  onToggleStep: (task: Task, step: TaskStep) => void;
  onDeleteStep: (task: Task, stepId: number) => void;
  onColorChange: (color: string | null) => void;
}

function TaskRow({
  task,
  onToggle,
  onDelete,
  onClick,
  onAddStep,
  onToggleStep,
  onDeleteStep,
  onColorChange,
}: TaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const [showStepInput, setShowStepInput] = useState(false);
  const [stepInput, setStepInput] = useState("");
  const [expanded, setExpanded] = useState(false);

  const hasSteps = task.steps && task.steps.length > 0;
  const doneSteps = task.steps?.filter((s) => s.done).length || 0;

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeftWidth: 5,
    borderLeftColor: task.color
      ? colorHexMap[task.color] ?? "transparent"
      : "transparent",
  };

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      {...attributes}
      {...listeners}
      className={`group relative mb-2 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm transition-shadow select-none dark:border-white/[0.06] dark:bg-zinc-900 ${
        isDragging
          ? "z-50 scale-[1.02] opacity-90 shadow-2xl ring-2 ring-indigo-500/20"
          : "hover:shadow-md"
      }`}
    >
      <div
        className="relative flex items-start gap-3.5 px-5 py-4"
        onClick={onClick}
      >
        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-slate-300 transition-colors hover:border-indigo-500 dark:border-zinc-600 dark:hover:border-indigo-400"
        />

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug tracking-tight text-slate-900 dark:text-zinc-100">
            {task.title}
          </p>

          <div className="mt-1.5 flex items-center gap-2">
            {task.due_date && (
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                <CalendarDays size={10} strokeWidth={1.5} />
                {new Date(task.due_date + "T00:00:00").toLocaleDateString(
                  "pt-BR",
                  { day: "2-digit", month: "short" }
                )}
              </span>
            )}
            {task.reminder_at && (() => {
              const d = new Date(task.reminder_at);
              const today = new Date();
              const isToday = d.toDateString() === today.toDateString();
              const timeStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
              const label = isToday ? timeStr : `${d.getDate()} ${d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()}, ${timeStr}`;
              return (
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-blue-400 dark:text-blue-500">
                  <Bell size={10} strokeWidth={1.5} />
                  {label}
                </span>
              );
            })()}
            {task.repeat && task.repeat !== "NONE" && (
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-orange-400 dark:text-orange-500">
                <Repeat size={10} strokeWidth={1.5} />
                {task.repeat === "DAILY"
                  ? "Diario"
                  : task.repeat === "WEEKLY"
                    ? "Semanal"
                    : task.repeat === "MONTHLY"
                      ? "Mensal"
                      : `${task.repeat_interval_days}d`}
              </span>
            )}
            {hasSteps && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
                className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 transition-colors hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-400"
              >
                {doneSteps}/{task.steps.length} passos
                {expanded ? (
                  <ChevronUp size={10} strokeWidth={2} />
                ) : (
                  <ChevronDown size={10} strokeWidth={2} />
                )}
              </button>
            )}
          </div>

          {/* Subtasks */}
          <AnimatePresence>
            {(expanded || showStepInput) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3 space-y-1 overflow-hidden border-t border-slate-100/80 pt-3 dark:border-white/[0.04]"
                onClick={(e) => e.stopPropagation()}
              >
                {task.steps.map((step) => (
                  <div
                    key={step.id}
                    className="group/step flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                  >
                    <button
                      onClick={() => onToggleStep(task, step)}
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
                        step.done
                          ? "border-indigo-500 bg-indigo-500 dark:border-indigo-400 dark:bg-indigo-400"
                          : "border-slate-300 dark:border-zinc-600"
                      }`}
                    >
                      {step.done && (
                        <Check
                          size={8}
                          strokeWidth={3}
                          className="text-white"
                        />
                      )}
                    </button>
                    <span
                      className={`flex-1 text-[13px] font-medium leading-none transition-all ${
                        step.done
                          ? "text-slate-300 line-through dark:text-zinc-600"
                          : "text-slate-600 dark:text-zinc-400"
                      }`}
                    >
                      {step.title}
                    </span>
                    <button
                      onClick={() => onDeleteStep(task, step.id)}
                      className="text-slate-200 opacity-0 transition-opacity group-hover/step:opacity-100 hover:text-red-400 dark:text-zinc-700 dark:hover:text-red-400"
                    >
                      <Trash2 size={12} strokeWidth={1.5} />
                    </button>
                  </div>
                ))}

                {showStepInput && (
                  <input
                    autoFocus
                    type="text"
                    value={stepInput}
                    onChange={(e) => setStepInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && stepInput.trim()) {
                        onAddStep(task, stepInput.trim());
                        setStepInput("");
                        setShowStepInput(false);
                      }
                      if (e.key === "Escape") setShowStepInput(false);
                    }}
                    onBlur={() => setShowStepInput(false)}
                    placeholder="Nome do passo..."
                    className="w-full border-b border-slate-200 bg-transparent py-1.5 text-xs font-medium text-slate-700 outline-none placeholder:text-slate-300 dark:border-zinc-700 dark:text-zinc-300 dark:placeholder:text-zinc-600"
                  />
                )}

                <button
                  onClick={() => {
                    setShowStepInput(true);
                    setExpanded(true);
                  }}
                  className="flex items-center gap-1.5 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 transition-colors hover:text-indigo-500 dark:text-zinc-600 dark:hover:text-indigo-400"
                >
                  <Plus size={10} strokeWidth={2} />
                  Subtarefa
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action buttons (hover) */}
        <div className="absolute right-4 top-4 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <ColorPopover.Root>
            <ColorPopover.Trigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-400"
              >
                <Palette size={13} strokeWidth={1.5} />
              </button>
            </ColorPopover.Trigger>
            <ColorPopover.Portal>
              <ColorPopover.Content
                side="bottom"
                align="end"
                sideOffset={4}
                className="z-[9999] flex gap-1.5 rounded-xl border border-slate-200/60 bg-white p-2.5 shadow-lg dark:border-white/[0.08] dark:bg-zinc-900"
                onClick={(e) => e.stopPropagation()}
              >
                {colorOptions.map((c) => (
                  <ColorPopover.Close asChild key={c.value}>
                    <button
                      onClick={() =>
                        onColorChange(
                          task.color === c.value ? null : c.value
                        )
                      }
                      className={`h-5 w-5 rounded-full transition-transform hover:scale-125 ${c.bg} ${
                        task.color === c.value
                          ? "ring-2 ring-offset-1 ring-slate-400 dark:ring-offset-zinc-900 dark:ring-zinc-500"
                          : ""
                      }`}
                    />
                  </ColorPopover.Close>
                ))}
                <ColorPopover.Close asChild>
                  <button
                    onClick={() => onColorChange(null)}
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-slate-300 text-[8px] text-slate-400 transition-transform hover:scale-125 dark:border-zinc-600 dark:text-zinc-600"
                  >
                    &times;
                  </button>
                </ColorPopover.Close>
              </ColorPopover.Content>
            </ColorPopover.Portal>
          </ColorPopover.Root>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-50 hover:text-red-400 dark:text-zinc-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            <Trash2 size={13} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* CompletedRow                                                               */
/* ========================================================================== */

interface CompletedRowProps {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
}

function CompletedRow({ task, onToggle, onDelete }: CompletedRowProps) {
  const timeStr = task.completed_at
    ? new Date(task.completed_at).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="group flex items-center gap-3.5 rounded-xl border border-slate-100/60 bg-slate-50/50 px-4 py-3 transition-colors dark:border-white/[0.04] dark:bg-zinc-800/30">
      <button
        onClick={onToggle}
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-emerald-400 bg-emerald-400 transition-colors dark:border-emerald-500 dark:bg-emerald-500"
      >
        <Check size={10} strokeWidth={3} className="text-white" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-slate-400 line-through dark:text-zinc-500">
          {task.title}
        </p>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500 dark:text-emerald-400">
        {timeStr}
      </span>
      <button
        onClick={onDelete}
        className="text-slate-200 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400 dark:text-zinc-700 dark:hover:text-red-400"
      >
        <Trash2 size={13} strokeWidth={1.5} />
      </button>
    </div>
  );
}

/* ========================================================================== */
/* HistoryOverlay                                                             */
/* ========================================================================== */

function HistoryOverlay({
  open,
  onClose,
  completed,
  onToggle,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  completed: Task[];
  onToggle: (task: Task) => void;
  onDelete: (taskId: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const filtered = completed.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (
      dateFilter &&
      t.completed_at &&
      !t.completed_at.startsWith(dateFilter)
    )
      return false;
    if (dateFilter && !t.completed_at) return false;
    return true;
  });

  const grouped = filtered.reduce<Record<string, Task[]>>((acc, task) => {
    const dateKey = task.completed_at?.split("T")[0] || "Sem data";
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(task);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[5vh] backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
            className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200/60 px-6 py-4 dark:border-white/[0.06]">
              <div>
                <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                  Historico de Tarefas
                </h2>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
                  {completed.length} concluida(s)
                </p>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex shrink-0 gap-3 border-b border-slate-100/80 px-6 py-3 dark:border-white/[0.04]">
              <div className="relative flex-1">
                <Search
                  size={14}
                  strokeWidth={1.5}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-zinc-600"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full rounded-lg border border-slate-200/60 bg-slate-50 py-2 pl-9 pr-3 text-xs font-medium text-slate-700 outline-none placeholder:text-slate-300 focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300 dark:placeholder:text-zinc-600"
                />
              </div>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="rounded-lg border border-slate-200/60 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none px-6 py-4">
              {sortedDates.length === 0 && (
                <p className="py-8 text-center text-xs font-medium text-slate-300 dark:text-zinc-600">
                  Nenhuma tarefa encontrada.
                </p>
              )}
              {sortedDates.map((dateKey) => (
                <div key={dateKey} className="mb-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
                    {dateKey !== "Sem data"
                      ? new Date(dateKey + "T00:00:00").toLocaleDateString(
                          "pt-BR",
                          {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }
                        )
                      : dateKey}
                  </p>
                  <div className="space-y-1">
                    {grouped[dateKey].map((task) => (
                      <CompletedRow
                        key={task.id}
                        task={task}
                        onToggle={() => onToggle(task)}
                        onDelete={() => onDelete(task.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}