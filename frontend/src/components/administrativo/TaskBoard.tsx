import { useState, useRef, useCallback, useEffect, useLayoutEffect, forwardRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
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
  ChevronRight,
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
  Star,
  LogIn,
} from "lucide-react";
import * as ContextMenu from "@radix-ui/react-context-menu";
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
/* BubbleRow — filtros arrastáveis (Meu Dia, Importante, etc) — DnD invisível  */
/* ========================================================================== */

function SortableDroppableBubble({
  id,
  label,
  isActive,
  onClick,
  onDelete,
}: {
  id: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const { attributes, listeners, setNodeRef: setSortableRef, transform, transition, isDragging } = useSortable({
    id: `bubble-${id}`,
  });
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: `bubble-${id}` });

  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      setSortableRef(el);
      setDroppableRef(el);
    },
    [setSortableRef, setDroppableRef]
  );

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setRefs}
      data-no-grab-scroll
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`p-1 -m-1 flex shrink-0 cursor-grab active:cursor-grabbing select-none items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
        isActive
          ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/30 dark:bg-indigo-500"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      } ${isDragging ? "opacity-80 shadow-lg ring-2 ring-indigo-400/50" : ""} ${
        isOver
          ? "scale-110 ring-2 ring-blue-400 shadow-[0_0_20px_rgba(96,165,250,0.8)] bg-blue-500/20 text-blue-400 z-50 dark:shadow-[0_0_20px_rgba(96,165,250,0.6)]"
          : ""
      }`}
    >
      <span className="min-w-0 truncate">{label}</span>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="-mr-1 rounded p-0.5 opacity-70 hover:opacity-100"
          aria-label="Remover lista"
        >
          <X size={10} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

function BubbleRow({
  bubbleOrder,
  onBubbleOrderChange,
  taskFilter,
  onTaskFilterChange,
  lists,
  onListsChange,
  onDeleteListRequest,
}: {
  bubbleOrder: string[];
  onBubbleOrderChange: (order: string[]) => void;
  taskFilter: TaskFilterValue;
  onTaskFilterChange: (filter: TaskFilterValue) => void;
  lists: { id: number; name: string }[];
  onListsChange: (lists: { id: number; name: string }[]) => void;
  onDeleteListRequest: (listId: number) => void;
}) {
  const [creatingNew, setCreatingNew] = useState(false);
  const [newListName, setNewListName] = useState("");
  const newInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const grabState = useRef({ isGrabbing: false, startX: 0, startScrollLeft: 0 });

  const handleGrabStart = useCallback((e: React.MouseEvent) => {
    if (e.target instanceof Element && (e.target.closest("[data-no-grab-scroll]") || e.target.closest("button"))) return;
    if (!scrollRef.current) return;
    grabState.current = { isGrabbing: true, startX: e.clientX, startScrollLeft: scrollRef.current.scrollLeft };
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      const state = grabState.current;
      if (!state.isGrabbing || !scrollRef.current) return;
      scrollRef.current.scrollLeft = state.startScrollLeft - (ev.clientX - state.startX);
    };
    const onEnd = () => {
      grabState.current.isGrabbing = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("mouseleave", onEnd);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("mouseleave", onEnd);
  }, []);

  const bubbleItems = bubbleOrder
    .filter((id) => {
      if (id.startsWith("list:")) {
        const listId = parseInt(id.split(":")[1] || "0", 10);
        return lists.some((l) => l.id === listId);
      }
      return DEFAULT_BUBBLES.some((b) => b.id === id);
    })
    .map((id) => ({
      id,
      label: id.startsWith("list:")
        ? lists.find((l) => l.id === parseInt(id.split(":")[1] || "0", 10))?.name ?? "Lista"
        : DEFAULT_BUBBLES.find((b) => b.id === id as TaskFilterId)?.label ?? id,
    }));

  const handleCreateList = useCallback(async () => {
    const name = newListName.trim() || "Nova Lista";
    setCreatingNew(false);
    setNewListName("");
    try {
      const created = await api.createTaskList(name);
      onListsChange([...lists, created]);
      onBubbleOrderChange([...bubbleOrder, `list:${created.id}`]);
      onTaskFilterChange(`list:${created.id}`);
    } catch (e) {
      console.error("Erro ao criar lista:", e);
    }
  }, [newListName, lists, bubbleOrder, onListsChange, onBubbleOrderChange, onTaskFilterChange]);

  const handleDeleteListClick = useCallback(
    (listId: number) => {
      onDeleteListRequest(listId);
    },
    [onDeleteListRequest]
  );

  useEffect(() => {
    if (creatingNew) newInputRef.current?.focus();
  }, [creatingNew]);

  const { setNodeRef: setZoneRef } = useDroppable({ id: "drop-bubble-zone" });

  return (
    <div
      ref={setZoneRef}
      onMouseDown={handleGrabStart}
      className="mt-3 flex w-full cursor-grab items-center gap-2 rounded-3xl border border-white/10 bg-white/5 px-3 py-2 active:cursor-grabbing dark:border-white/[0.06] dark:bg-white/[0.03]"
    >
      <div
        ref={scrollRef}
        className="flex min-w-0 flex-1 flex-nowrap gap-2 overflow-x-auto scrollbar-hide"
        style={{
          maskImage: "linear-gradient(to right, black 90%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, black 90%, transparent 100%)",
        }}
      >
            <SortableContext
              items={bubbleItems.map((b) => `bubble-${b.id}`)}
              strategy={horizontalListSortingStrategy}
            >
              {bubbleItems.map(({ id, label }) => (
                <SortableDroppableBubble
                  key={id}
                  id={id}
                  label={label}
                  isActive={taskFilter === id}
                  onClick={() => onTaskFilterChange(id as TaskFilterValue)}
                  onDelete={id.startsWith("list:") ? () => handleDeleteListClick(parseInt(id.split(":")[1] || "0", 10)) : undefined}
                />
              ))}
            </SortableContext>
      </div>
      {creatingNew ? (
        <div
          data-no-grab-scroll
          className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-slate-300/80 bg-transparent px-3 py-1 dark:border-zinc-600/80"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={newInputRef}
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateList();
              if (e.key === "Escape") {
                setCreatingNew(false);
                setNewListName("");
              }
            }}
            onBlur={() => {
              if (newListName.trim()) handleCreateList();
              else {
                setCreatingNew(false);
                setNewListName("");
              }
            }}
            placeholder="Nome da lista"
            className="w-28 min-w-0 bg-transparent text-xs font-semibold outline-none placeholder:text-slate-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            data-no-dnd="true"
          />
        </div>
      ) : (
        <button
          type="button"
          data-no-grab-scroll
          onClick={() => setCreatingNew(true)}
          className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-slate-300/80 bg-transparent px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-600/80 dark:text-zinc-500 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
        >
          <Plus size={12} strokeWidth={2} />
          Lista
        </button>
      )}
    </div>
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

/** Retorna true se o DateTime (date YYYY-MM-DD + time HH:mm) for anterior ou igual a agora. */
function isReminderInPast(date: string, time: string): boolean {
  if (!date || !time || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{1,2}$/.test(time)) return false;
  const dt = new Date(`${date}T${time}:00`);
  return !isNaN(dt.getTime()) && dt.getTime() <= Date.now();
}

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

export type TaskFilterId = "meu_dia" | "importante" | "planejado" | "geral";

export type TaskFilterValue = TaskFilterId | `list:${number}`;

const BUBBLE_ORDER_KEY = "guardian-task-bubble-order";

const DEFAULT_BUBBLES: { id: TaskFilterId; label: string }[] = [
  { id: "meu_dia", label: "Meu Dia" },
  { id: "importante", label: "Importante" },
  { id: "planejado", label: "Atribuído a mim" },
  { id: "geral", label: "Geral" },
];

function loadBubbleOrder(lists: { id: number }[]): string[] {
  try {
    const s = localStorage.getItem(BUBBLE_ORDER_KEY);
    if (s) {
      const parsed = JSON.parse(s) as string[];
      const defaultIds = DEFAULT_BUBBLES.map((b) => b.id);
      const listIds = lists.map((l) => `list:${l.id}`);
      const valid = parsed.filter(
        (id) =>
          defaultIds.includes(id as TaskFilterId) ||
          (id.startsWith("list:") && listIds.includes(id))
      );
      const missingDefaults = defaultIds.filter((d) => !valid.includes(d));
      const missingLists = listIds.filter((l) => !valid.includes(l));
      return [...valid, ...missingDefaults, ...missingLists];
    }
  } catch { /* localStorage inválido */ }
  return [...DEFAULT_BUBBLES.map((b) => b.id), ...lists.map((l) => `list:${l.id}`)];
}

interface TaskBoardProps {
  pending: Task[];
  completed: Task[];
  taskFilter: TaskFilterValue;
  onTaskFilterChange: (filter: TaskFilterValue) => void;
  lists: { id: number; name: string }[];
  onListsChange: (lists: { id: number; name: string }[]) => void;
  onRefresh: () => void;
}

/* ========================================================================== */
/* TaskBoard                                                                  */
/* ========================================================================== */

export function TaskBoard({
  pending,
  completed,
  taskFilter,
  onTaskFilterChange,
  lists,
  onListsChange,
  onRefresh,
}: TaskBoardProps) {
  const [quickInput, setQuickInput] = useState("");
  const [quickMeta, setQuickMeta] = useState<QuickMeta>(emptyMeta);
  const [activePopover, setActivePopover] = useState<
    "start" | "due" | "reminder" | "repeat" | null
  >(null);
  const [hoveredQuickAction, setHoveredQuickAction] = useState<"start" | "due" | "reminder" | "repeat" | null>(null);
  const [showManualDelivery, setShowManualDelivery] = useState(false);
  const [showManualReminder, setShowManualReminder] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [reminderExpiredFeedback, setReminderExpiredFeedback] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [bubbleOrder, setBubbleOrder] = useState<string[]>(() => loadBubbleOrder(lists));
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<number | null>(null);
  const [confirmDeleteList, setConfirmDeleteList] = useState<number | null>(null);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const cancelTaskRef = useRef<HTMLButtonElement>(null);
  const confirmTaskRef = useRef<HTMLButtonElement>(null);
  const cancelListRef = useRef<HTMLButtonElement>(null);
  const confirmListRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setBubbleOrder((prev) => {
      const listIds = lists.map((l) => `list:${l.id}`);
      const newListIds = listIds.filter((id) => !prev.includes(id));
      if (newListIds.length === 0) return prev;
      const next = [...prev, ...newListIds];
      localStorage.setItem(BUBBLE_ORDER_KEY, JSON.stringify(next));
      return next;
    });
  }, [lists]);

  const saveBubbleOrder = useCallback((order: string[]) => {
    setBubbleOrder(order);
    localStorage.setItem(BUBBLE_ORDER_KEY, JSON.stringify(order));
  }, []);

  // --- MÁGICA EM TEMPO REAL (O Erro vermelho foi resolvido aqui) ---
  const smartParsed = quickInput.trim() ? parseSmartInput(quickInput) : { title: "", reminderAt: null, dueDate: null };
  const hasSmartReminder = !!smartParsed.reminderAt;
  const hasSmartDate = !!smartParsed.dueDate && !hasSmartReminder;

  const inputRef = useRef<HTMLInputElement>(null);
  const mainInputContainerRef = useRef<HTMLDivElement>(null);
  const buttonGroupRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  useEffect(() => {
    if (!activeTask) return;
    const id = activeTask.id;
    const updated = [...pending, ...completed].find((t) => t.id === id);
    if (updated) setActiveTask(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, completed]);

  // Abrir tarefa vinda do lembrete (ReminderToast)
  useEffect(() => {
    const win = window as unknown as { __pendingReminderTask?: Task };
    const pending = win.__pendingReminderTask;
    if (pending) {
      delete win.__pendingReminderTask;
      setActiveTask(pending);
    }
    const handler = (e: CustomEvent<Task>) => {
      setActiveTask(e.detail);
    };
    window.addEventListener("reminder-open-task", handler as EventListener);
    return () => window.removeEventListener("reminder-open-task", handler as EventListener);
  }, []);

  // Atualizar ao montar (quando o usuário abre a aba de tarefas)
  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  // Atualizar ao voltar para o app (faxina do Vigia refletida)
  useEffect(() => {
    window.addEventListener("focus", onRefresh);
    return () => window.removeEventListener("focus", onRefresh);
  }, [onRefresh]);

  // Atualizar lista quando lembrete for adiado ou ignorado
  useEffect(() => {
    const handler = () => onRefresh();
    window.addEventListener("reminder-updated", handler);
    return () => window.removeEventListener("reminder-updated", handler);
  }, [onRefresh]);

  // Atualizar lista quando notificação de lembrete for disparada (ícone some do card)
  useEffect(() => {
    const handler = () => onRefresh();
    window.addEventListener("reminder-triggered", handler);
    return () => window.removeEventListener("reminder-triggered", handler);
  }, [onRefresh]);

  // Autolimpeza: se lembrete selecionado estiver no passado, resetar
  useEffect(() => {
    const { reminderDate, reminderTime } = quickMeta;
    if (reminderDate && reminderTime && isReminderInPast(reminderDate, reminderTime)) {
      setQuickMeta((prev) => ({ ...prev, reminderDate: "", reminderTime: "" }));
      setReminderExpiredFeedback(true);
      const t = setTimeout(() => setReminderExpiredFeedback(false), 3000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apenas reminderDate/Time
  }, [quickMeta.reminderDate, quickMeta.reminderTime]);

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

  const todayCompleted = completed
    .filter((t) => t.completed_at && t.completed_at.startsWith(todayStr))
    .sort((a, b) => {
      const aAt = a.completed_at || "";
      const bAt = b.completed_at || "";
      return bAt.localeCompare(aAt); // Mais recente primeiro (cronológico inverso)
    });

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
    // Data de início: Bubble "Meu Dia" força hoje; "Atribuído a mim" força amanhã
    if (taskFilter === "meu_dia") {
      payload.start_date = quickMeta.startDate || todayStr;
    } else if (taskFilter === "planejado") {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      payload.start_date = quickMeta.startDate || tomorrow.toISOString().split("T")[0];
    } else {
      payload.start_date = quickMeta.startDate || null;
    }
    if (taskFilter === "importante") {
      payload.is_important = true;
    }
    // Atribuído a Mim (planejado): atributo fixo — NUNCA removido por Meu Dia ou Importante
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
    await api.createTask(payload);
    onRefresh();
  }, [quickInput, quickMeta, taskFilter, onRefresh, todayStr]);

  const handleTaskDropOnBubble = useCallback(
    async (taskId: number, bubbleId: string) => {
      const todayStr = new Date().toISOString().split("T")[0];
      const payload: Record<string, unknown> = {};
      if (bubbleId === "meu_dia") {
        payload.start_date = todayStr;
        // Não altera is_assigned — tarefa continua em "Atribuído a Mim" se já estava
      } else if (bubbleId === "importante") {
        payload.is_important = true;
      } else if (bubbleId === "geral") {
        // Nenhuma ação — apenas troca a visão para Geral
      } else if (bubbleId.startsWith("list:")) {
        const listId = parseInt(bubbleId.split(":")[1] || "0", 10);
        payload.list_id = listId || null;
      } else if (bubbleId === "planejado") {
        payload.is_assigned = true;
      }
      if (Object.keys(payload).length > 0) {
        await api.updateTask(taskId, payload);
        onRefresh();
      }
    },
    [onRefresh]
  );

  const handleDragStart = useCallback((event: { active: { id: unknown } }) => {
    const id = event.active.id;
    setActiveDragId(typeof id === "number" ? id : null);
  }, []);

  const handleDragOver = useCallback((event: { over: { id: unknown } | null }) => {
    setDragOverId(event.over ? String(event.over.id) : null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDragId(null);
      setDragOverId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const overStr = String(over.id);
      const activeStr = String(active.id);

      // Task drop on Bubble
      if (overStr.startsWith("bubble-") && !activeStr.startsWith("bubble-")) {
        const bubbleId = overStr.replace("bubble-", "");
        const taskId = typeof active.id === "number" ? active.id : parseInt(activeStr, 10);
        if (!isNaN(taskId) && bubbleId) {
          await handleTaskDropOnBubble(taskId, bubbleId);
        }
        return;
      }

      // Bubble reorder
      if (activeStr.startsWith("bubble-") && overStr.startsWith("bubble-")) {
        const oldIdx = bubbleOrder.findIndex((id) => `bubble-${id}` === activeStr);
        const newIdx = bubbleOrder.findIndex((id) => `bubble-${id}` === overStr);
        if (oldIdx !== -1 && newIdx !== -1) {
          const reordered = arrayMove(bubbleOrder, oldIdx, newIdx);
          saveBubbleOrder(reordered);
        }
        return;
      }

      // Task reorder
      const oldIdx = pending.findIndex((t) => t.id === active.id);
      const newIdx = pending.findIndex((t) => t.id === over.id);
      if (oldIdx !== -1 && newIdx !== -1) {
        const reordered = arrayMove(pending, oldIdx, newIdx);
        try {
          await api.reorderTasks(reordered.map((t) => t.id));
          onRefresh();
        } catch (e) {
          console.error("Erro ao reordenar:", e);
        }
      }
    },
    [pending, bubbleOrder, saveBubbleOrder, handleTaskDropOnBubble, onRefresh]
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
      setConfirmDeleteTask(taskId);
    },
    []
  );

  const handleDeleteConfirm = useCallback(
    async () => {
      if (!confirmDeleteTask) return;
      await api.deleteTask(confirmDeleteTask);
      if (activeTask?.id === confirmDeleteTask) setActiveTask(null);
      setConfirmDeleteTask(null);
      onRefresh();
    },
    [confirmDeleteTask, activeTask, onRefresh]
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
      await api.updateTask(taskId, { color: color || "" });
      onRefresh();
    },
    [onRefresh]
  );

  const handleImportantToggle = useCallback(
    async (taskId: number) => {
      const t = [...pending, ...completed].find((x) => x.id === taskId);
      if (!t) return;
      await api.updateTask(taskId, { is_important: !(t.is_important ?? false) });
      onRefresh();
    },
    [pending, completed, onRefresh]
  );

  const handleMyDayToggle = useCallback(
    async (taskId: number) => {
      const t = [...pending, ...completed].find((x) => x.id === taskId);
      if (!t) return;
      const todayStr = new Date().toISOString().split("T")[0];
      const isInMyDay = t.start_date && t.start_date <= todayStr;
      // Apenas altera start_date; NÃO altera is_assigned — tarefa continua em "Atribuído a Mim"
      await api.updateTask(taskId, { start_date: isInMyDay ? "" : todayStr });
      onRefresh();
    },
    [pending, completed, onRefresh]
  );

  const handleSetStartDate = useCallback(
    async (taskId: number, dateStr: string | null) => {
      await api.updateTask(taskId, { start_date: dateStr });
      onRefresh();
    },
    [onRefresh]
  );

  const handleMoveToList = useCallback(
    async (taskId: number, listId: number | null) => {
      await api.updateTask(taskId, { list_id: listId });
      onRefresh();
    },
    [onRefresh]
  );

  // Atalhos globais: Ctrl+T (Meu Dia), Ctrl+D (Concluir) — quando SideSheet aberta
  useEffect(() => {
    if (!activeTask) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "t") {
        e.preventDefault();
        handleMyDayToggle(activeTask.id);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        handleToggle(activeTask);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTask, handleMyDayToggle, handleToggle]);

  const handleDeleteListRequest = useCallback((listId: number) => {
    setConfirmDeleteList(listId);
  }, []);

  const handleDeleteListConfirm = useCallback(async () => {
    if (!confirmDeleteList) return;
    try {
      await api.deleteTaskList(confirmDeleteList);
      onListsChange(lists.filter((l) => l.id !== confirmDeleteList));
      const newOrder = bubbleOrder.filter((id) => id !== `list:${confirmDeleteList}`);
      saveBubbleOrder(newOrder);
      if (taskFilter === `list:${confirmDeleteList}`) {
        onTaskFilterChange("meu_dia");
      }
      onRefresh();
    } catch (e) {
      console.error("Erro ao excluir lista:", e);
    } finally {
      setConfirmDeleteList(null);
    }
  }, [confirmDeleteList, lists, bubbleOrder, taskFilter, onListsChange, saveBubbleOrder, onTaskFilterChange, onRefresh]);

  useEffect(() => {
    if (!confirmDeleteTask) return;
    const t = setTimeout(() => confirmTaskRef.current?.focus(), 0);
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setConfirmDeleteTask(null);
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const active = document.activeElement as HTMLButtonElement;
        if (active === cancelTaskRef.current || active === confirmTaskRef.current) {
          active.click();
        }
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        cancelTaskRef.current?.focus();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        confirmTaskRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", handler);
    };
  }, [confirmDeleteTask]);

  useEffect(() => {
    if (!confirmDeleteList) return;
    const t = setTimeout(() => confirmListRef.current?.focus(), 0);
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setConfirmDeleteList(null);
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const active = document.activeElement as HTMLButtonElement;
        if (active === cancelListRef.current || active === confirmListRef.current) {
          active.click();
        }
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        cancelListRef.current?.focus();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        confirmListRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", handler);
    };
  }, [confirmDeleteList]);

  const hasStartDate = !!quickMeta.startDate;
  const hasDate = !!quickMeta.dueDate;
  const hasReminder = !!(quickMeta.reminderDate && quickMeta.reminderTime);
  const hasRepeat = quickMeta.repeat !== "NONE";

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
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
                          setQuickMeta({ ...quickMeta, reminderDate: "", reminderTime: "" });
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

          {/* Bubbles — filtros arrastáveis */}
          <BubbleRow
            bubbleOrder={bubbleOrder}
            onBubbleOrderChange={saveBubbleOrder}
            taskFilter={taskFilter}
            onTaskFilterChange={onTaskFilterChange}
            lists={lists}
            onListsChange={onListsChange}
            onDeleteListRequest={handleDeleteListRequest}
          />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Pending tasks — sortable via press-to-drag                       */}
        {/* ---------------------------------------------------------------- */}
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none px-6 pb-2">
            <SortableContext
              items={pending.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {pending.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  lists={lists}
                  onToggle={() => handleToggle(task)}
                  onDelete={() => handleDelete(task.id)}
                  onClick={() => setActiveTask(task)}
                  onTitleChange={async (t, newTitle) => {
                    await api.updateTask(t.id, { title: newTitle });
                    onRefresh();
                  }}
                  onImportantToggle={() => handleImportantToggle(task.id)}
                  onMyDayAdd={() => handleMyDayToggle(task.id)}
                  onSetStartDate={(date) => handleSetStartDate(task.id, date)}
                  onMoveToList={(listId) => handleMoveToList(task.id, listId)}
                  onAddStep={handleAddStep}
                  onToggleStep={handleToggleStep}
                  onDeleteStep={handleDeleteStep}
                  onColorChange={(color) =>
                    handleColorChange(task.id, color)
                  }
                />
              ))}
            </SortableContext>

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

      <DragOverlay>
        {activeDragId ? (() => {
          const task = pending.find((t) => t.id === activeDragId);
          if (!task) return null;
          const isOverBubbleZone = dragOverId?.startsWith("bubble-") || dragOverId === "drop-bubble-zone";
          return (
            <motion.div
              layout
              initial={false}
              animate={{
                scale: isOverBubbleZone ? 0.9 : 1,
                opacity: 0.95,
              }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className={`overflow-hidden shadow-2xl ${
                isOverBubbleZone
                  ? "rounded-full bg-blue-600 border-none shadow-blue-500/50 flex items-center justify-center p-3"
                  : "rounded-2xl border border-slate-200/60 bg-white dark:border-white/[0.06] dark:bg-zinc-900"
              }`}
              style={{
                borderLeftWidth: isOverBubbleZone ? 0 : 5,
                borderLeftColor: !isOverBubbleZone && task.color ? (colorHexMap[task.color] ?? "transparent") : "transparent",
              }}
            >
              {isOverBubbleZone ? (
                <motion.div layout className="flex items-center gap-2 px-2 text-white">
                  <LogIn size={16} strokeWidth={2.5} />
                  <span className="text-xs font-bold tracking-widest uppercase">Mover Tarefa</span>
                </motion.div>
              ) : (
                <motion.div layout className="flex items-center gap-3 px-5 py-4">
                  <div className="h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] border-slate-300 dark:border-zinc-600" />
                  <p className="truncate text-[15px] font-semibold leading-snug tracking-tight text-slate-900 dark:text-zinc-100">
                    {task.title}
                  </p>
                </motion.div>
              )}
            </motion.div>
          );
        })() : null}
      </DragOverlay>
      </DndContext>

      {/* Modal: confirmar exclusão de tarefa */}
      <AnimatePresence>
        {confirmDeleteTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setConfirmDeleteTask(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xl dark:border-white/[0.08] dark:bg-zinc-900"
            >
              <p className="mb-6 text-center text-sm font-semibold text-slate-700 dark:text-zinc-300">
                Tem certeza que deseja excluir esta tarefa?
              </p>
              <div className="flex gap-3">
                <button
                  ref={cancelTaskRef}
                  type="button"
                  onClick={() => setConfirmDeleteTask(null)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  ref={confirmTaskRef}
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: confirmar exclusão de lista */}
      <AnimatePresence>
        {confirmDeleteList && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setConfirmDeleteList(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xl dark:border-white/[0.08] dark:bg-zinc-900"
            >
              <p className="mb-2 text-center text-sm font-semibold text-slate-700 dark:text-zinc-300">
                Tem certeza que deseja excluir esta lista?
              </p>
              <p className="mb-6 text-center text-xs text-amber-600 dark:text-amber-500">
                Atenção: excluir esta lista removerá permanentemente todas as tarefas contidas nela.
              </p>
              <div className="flex gap-3">
                <button
                  ref={cancelListRef}
                  type="button"
                  onClick={() => setConfirmDeleteList(null)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  ref={confirmListRef}
                  type="button"
                  onClick={handleDeleteListConfirm}
                  className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

/* TooltipButton — tooltip via Portal (flutua sobre viewport, sem overflow) */
const TooltipButton = forwardRef<
  HTMLButtonElement,
  { label: string; children: React.ReactNode; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function TooltipButton({ label, children, className = "", ...props }, ref) {
  const [hovered, setHovered] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const innerRef = useRef<HTMLButtonElement | null>(null);

  const setRefs = useCallback((el: HTMLButtonElement | null) => {
    (innerRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = el;
  }, [ref]);

  const updateRect = useCallback(() => {
    const el = innerRef.current;
    if (el) setRect(el.getBoundingClientRect());
  }, []);

  useEffect(() => {
    if (!hovered) return;
    updateRect();
  }, [hovered, updateRect]);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
    setRect(null);
  }, []);

  const tooltipEl = hovered && rect && typeof document !== "undefined" ? createPortal(
    <div
      className="fixed z-[99999] pointer-events-none whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg dark:bg-zinc-700"
      style={{
        left: rect.left + rect.width / 2,
        top: rect.top - 6,
        transform: "translate(-50%, -100%)",
      }}
    >
      {label}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={setRefs}
        type="button"
        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${className}`}
        aria-label={label}
        onMouseEnter={() => { setHovered(true); updateRect(); }}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {children}
      </button>
      {tooltipEl}
    </>
  );
});

interface TaskRowProps {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onClick: () => void;
  onTitleChange: (task: Task, newTitle: string) => void | Promise<void>;
  onImportantToggle: () => void;
  onMyDayAdd: () => void; // Toggle Meu Dia (hoje/null)
  onSetStartDate: (date: string | null) => void;
  onMoveToList: (listId: number | null) => void;
  onAddStep: (task: Task, title: string) => void;
  onToggleStep: (task: Task, step: TaskStep) => void;
  onDeleteStep: (task: Task, stepId: number) => void;
  onColorChange: (color: string | null) => void;
  lists: { id: number; name: string }[];
}

function TaskRow({
  task,
  onToggle,
  onDelete,
  onClick,
  onTitleChange,
  onImportantToggle,
  onMyDayAdd,
  onSetStartDate,
  onMoveToList,
  onAddStep,
  onToggleStep,
  onDeleteStep,
  onColorChange,
  lists,
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
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [colorPopoverOpen, setColorPopoverOpen] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(task.title);
  const [inputWidth, setInputWidth] = useState(20);
  const sizerRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (isEditingTitle && sizerRef.current) {
      const w = sizerRef.current.scrollWidth;
      setInputWidth(Math.max(20, w + 4));
    }
  }, [editTitleValue, isEditingTitle]);

  const hasSteps = task.steps && task.steps.length > 0;

  const startEditing = useCallback(() => {
    setEditTitleValue(task.title);
    setIsEditingTitle(true);
  }, [task.title]);
  const doneSteps = task.steps?.filter((s) => s.done).length || 0;

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeftWidth: 5,
    borderLeftColor: task.color
      ? colorHexMap[task.color] ?? "transparent"
      : "transparent",
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrowStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  })();
  const isInMyDay = task.start_date && task.start_date <= todayStr;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
    <div
      ref={setNodeRef}
      style={sortableStyle}
      {...attributes}
      {...listeners}
      className={`group relative mb-1.5 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm transition-shadow select-none dark:border-white/[0.06] dark:bg-zinc-900 hover:shadow-md ${
        isDragging ? "opacity-50 shadow-lg" : ""
      }`}
    >
      <div
        className="relative flex items-start gap-2.5 px-4 py-2.5"
        onClick={onClick}
      >
        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="mt-0.5 flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-slate-300 transition-colors hover:border-indigo-500 dark:border-zinc-600 dark:hover:border-indigo-400"
        />

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Título: hitbox restrita ao texto; espaço vazio abre SideSheet */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-fit max-w-full"
          >
            {isEditingTitle ? (
              <span className="relative inline-block">
                <span
                  ref={sizerRef}
                  aria-hidden
                  className="invisible absolute left-0 top-0 whitespace-pre text-[14px] font-semibold leading-snug tracking-tight"
                  style={{ pointerEvents: "none" }}
                >
                  {editTitleValue || "\u00A0"}
                </span>
                <input
                  type="text"
                  value={editTitleValue}
                  onChange={(e) => setEditTitleValue(e.target.value)}
                  onBlur={() => {
                    const trimmed = editTitleValue.trim();
                    if (trimmed && trimmed !== task.title) {
                      onTitleChange(task, trimmed);
                    } else {
                      setEditTitleValue(task.title);
                    }
                    setIsEditingTitle(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                    if (e.key === "Escape") {
                      setEditTitleValue(task.title);
                      setIsEditingTitle(false);
                      e.currentTarget.blur();
                    }
                  }}
                  autoFocus
                  style={{ width: inputWidth }}
                  className="min-w-[2ch] bg-transparent text-[14px] font-semibold leading-snug tracking-tight text-slate-900 outline-none dark:text-zinc-100"
                />
              </span>
            ) : (
              <p
                onClick={(e) => {
                  e.stopPropagation();
                  startEditing();
                }}
                className="cursor-text text-[14px] font-semibold leading-snug tracking-tight text-slate-900 dark:text-zinc-100"
              >
                {task.title}
              </p>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {task.due_date && (() => {
              const today = new Date().toISOString().split("T")[0];
              const isOverdue = task.status === "PENDENTE" && task.due_date < today;
              return (
                <span className={`flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                  isOverdue ? "text-red-500 dark:text-red-400" : "text-slate-400 dark:text-zinc-500"
                }`}>
                  <CalendarDays size={9} strokeWidth={1.5} />
                  {new Date(task.due_date + "T00:00:00").toLocaleDateString(
                    "pt-BR",
                    { day: "2-digit", month: "short" }
                  )}
                  {isOverdue && <span className="font-bold">ATRASADO</span>}
                </span>
              );
            })()}
            {task.reminder_at && (() => {
              const d = new Date(task.reminder_at);
              const today = new Date();
              const isToday = d.toDateString() === today.toDateString();
              const timeStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
              const label = isToday ? timeStr : `${d.getDate()} ${d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()}, ${timeStr}`;
              return (
                <span className="flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider text-blue-400 dark:text-blue-500">
                  <Bell size={9} strokeWidth={1.5} />
                  {label}
                </span>
              );
            })()}
            {task.repeat && task.repeat !== "NONE" && (
              <span className="flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider text-orange-400 dark:text-orange-500">
                <Repeat size={9} strokeWidth={1.5} />
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
                className="flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-400"
              >
                {doneSteps}/{task.steps.length} passos
                {expanded ? (
                  <ChevronUp size={9} strokeWidth={2} />
                ) : (
                  <ChevronDown size={9} strokeWidth={2} />
                )}
              </button>
            )}
            {/* + Subtarefa / Nova subtarefa — mesma altura para evitar salto */}
            <div className="flex min-h-[18px] items-center">
              {!showStepInput ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowStepInput(true);
                    setExpanded(true);
                  }}
                  className="flex h-[18px] items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 text-[9px] font-semibold uppercase tracking-wider text-slate-400 hover:text-indigo-500 dark:text-zinc-600 dark:hover:text-indigo-400"
                >
                  <Plus size={9} strokeWidth={2} />
                  Subtarefa
                </button>
              ) : (
                <input
                  autoFocus
                  type="text"
                  value={stepInput}
                  onChange={(e) => setStepInput(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter" && stepInput.trim()) {
                      onAddStep(task, stepInput.trim());
                      setStepInput("");
                      setShowStepInput(false);
                    }
                    if (e.key === "Escape") setShowStepInput(false);
                  }}
                  onBlur={() => setShowStepInput(false)}
                  placeholder="Nova subtarefa..."
                  className="h-[18px] min-w-[100px] max-w-[160px] border-b border-slate-200 bg-transparent px-0 py-0.5 text-[12px] font-medium leading-tight text-slate-700 outline-none placeholder:text-slate-300 dark:border-zinc-600 dark:text-zinc-300 dark:placeholder:text-zinc-500"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          </div>

          {/* Subtasks — só a lista; + Subtarefa está na linha acima */}
          <AnimatePresence>
            {hasSteps && expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-2 space-y-0.5 overflow-hidden border-t border-slate-100/80 pt-2 dark:border-white/[0.04]"
                onClick={(e) => e.stopPropagation()}
              >
                {task.steps.map((step) => (
                  <div
                    key={step.id}
                    className="group/step flex items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                  >
                    <button
                      onClick={() => onToggleStep(task, step)}
                      className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
                        step.done
                          ? "border-indigo-500 bg-indigo-500 dark:border-indigo-400 dark:bg-indigo-400"
                          : "border-slate-300 dark:border-zinc-600"
                      }`}
                    >
                      {step.done && (
                        <Check
                          size={6}
                          strokeWidth={3}
                          className="text-white"
                        />
                      )}
                    </button>
                    <span
                      className={`flex-1 text-[12px] font-medium leading-none transition-all ${
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
                      <Trash2 size={10} strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Cockpit: Estrela, Sol, Cor, Lixeira — à direita com tooltips */}
        <div className="absolute right-3 top-2.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <TooltipButton
            label={task.is_important ? "Remover destaque" : "Marcar como importante"}
            onClick={(e) => {
              e.stopPropagation();
              onImportantToggle();
            }}
            className="text-slate-300 hover:bg-slate-100 hover:text-amber-500 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-amber-400"
          >
            <Star
              size={13}
              strokeWidth={1.5}
              className={task.is_important ? "fill-amber-400 text-amber-400" : ""}
            />
          </TooltipButton>
          <TooltipButton
            label={
              (() => {
                const today = new Date().toISOString().split("T")[0];
                const isActive = task.start_date && task.start_date <= today;
                return isActive ? "Remover do Meu Dia" : "Adicionar ao Meu Dia";
              })()
            }
            onClick={(e) => {
              e.stopPropagation();
              onMyDayAdd();
            }}
            className={`hover:bg-slate-100 dark:hover:bg-zinc-800 ${
              (() => {
                const today = new Date().toISOString().split("T")[0];
                const isActive = task.start_date && task.start_date <= today;
                return isActive
                  ? "text-orange-400 fill-orange-400 dark:text-orange-400 dark:fill-orange-400"
                  : "text-slate-300 hover:text-orange-500 dark:text-zinc-600 dark:hover:text-orange-400";
              })()
            }`}
          >
            <Sun size={13} strokeWidth={1.5} />
          </TooltipButton>
          <ColorPopover.Root open={colorPopoverOpen} onOpenChange={setColorPopoverOpen}>
            <ColorPopover.Trigger asChild>
              <TooltipButton
                label="Cor"
                className="text-slate-300 hover:bg-slate-100 hover:text-slate-500 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-400"
                onClick={(e) => e.stopPropagation()}
              >
                <Palette size={13} strokeWidth={1.5} />
              </TooltipButton>
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
                  <button
                    key={c.value}
                    onClick={async (e) => {
                      e.stopPropagation();
                      const newColor = task.color === c.value ? "" : c.value;
                      await onColorChange(newColor);
                      setColorPopoverOpen(false);
                    }}
                    className={`h-5 w-5 rounded-full transition-transform hover:scale-125 ${c.bg} ${
                      task.color === c.value
                        ? "ring-2 ring-offset-1 ring-slate-400 dark:ring-offset-zinc-900 dark:ring-zinc-500"
                        : ""
                    }`}
                  />
                ))}
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    await onColorChange("");
                    setColorPopoverOpen(false);
                  }}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-slate-300 text-[8px] text-slate-400 transition-transform hover:scale-125 dark:border-zinc-600 dark:text-zinc-600"
                >
                  &times;
                </button>
              </ColorPopover.Content>
            </ColorPopover.Portal>
          </ColorPopover.Root>
          <TooltipButton
            label="Excluir"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-slate-300 hover:bg-red-50 hover:text-red-400 dark:text-zinc-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            <Trash2 size={13} strokeWidth={1.5} />
          </TooltipButton>
        </div>
      </div>
    </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="z-[9999] min-w-[200px] rounded-xl border border-white/10 bg-zinc-900 py-1 shadow-xl"
          style={{ background: "rgb(var(--menu-bg))", color: "rgb(var(--menu-text))" }}
        >
          <ContextMenu.Item
            className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white"
            onSelect={() => onMyDayAdd()}
          >
            <Sun size={14} strokeWidth={1.5} />
            {isInMyDay ? "Remover do Meu Dia" : "Adicionar ao Meu Dia"}
            <span className="ml-auto text-[10px] text-zinc-400">Ctrl+T</span>
          </ContextMenu.Item>
          <ContextMenu.Item
            className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white"
            onSelect={() => onImportantToggle()}
          >
            <Star size={14} strokeWidth={1.5} className={task.is_important ? "fill-amber-400 text-amber-400" : ""} />
            {task.is_important ? "Remover destaque" : "Marcar como importante"}
          </ContextMenu.Item>
          <ContextMenu.Item
            className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white"
            onSelect={() => onToggle()}
          >
            <Check size={14} strokeWidth={1.5} />
            Marcar como concluída
            <span className="ml-auto text-[10px] text-zinc-400">Ctrl+D</span>
          </ContextMenu.Item>
          <ContextMenu.Separator className="my-1 h-px bg-zinc-700" />
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white data-[state=open]:bg-indigo-500/30 data-[state=open]:text-white">
              <CalendarDays size={14} strokeWidth={1.5} />
              Data de início
              <ChevronRight size={12} className="ml-auto" />
            </ContextMenu.SubTrigger>
            <ContextMenu.Portal>
              <ContextMenu.SubContent
                className="z-[10000] min-w-[160px] rounded-xl border border-white/10 bg-zinc-900 py-1 shadow-xl"
              >
                <ContextMenu.Item
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white"
                  onSelect={() => onSetStartDate(todayStr)}
                >
                  Hoje
                </ContextMenu.Item>
                <ContextMenu.Item
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white"
                  onSelect={() => onSetStartDate(tomorrowStr)}
                >
                  Amanhã
                </ContextMenu.Item>
                <ContextMenu.Item
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white"
                  onSelect={() => onSetStartDate(null)}
                >
                  Remover data
                </ContextMenu.Item>
                <ContextMenu.Separator className="my-1 h-px bg-zinc-700" />
                <ContextMenu.Item
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white"
                  onSelect={() => onClick()}
                >
                  Selecionar data...
                </ContextMenu.Item>
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>
          {lists.length > 0 && (
            <ContextMenu.Sub>
              <ContextMenu.SubTrigger className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white data-[state=open]:bg-indigo-500/30 data-[state=open]:text-white">
                <span>📂</span>
                Mover tarefa para...
                <ChevronRight size={12} className="ml-auto" />
              </ContextMenu.SubTrigger>
              <ContextMenu.Portal>
                <ContextMenu.SubContent
                  className="z-[10000] max-h-[240px] min-w-[160px] overflow-y-auto rounded-xl border border-white/10 bg-zinc-900 py-1 shadow-xl"
                >
                  {lists.map((l) => (
                    <ContextMenu.Item
                      key={l.id}
                      className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white"
                      onSelect={() => onMoveToList(l.id)}
                    >
                      {l.name}
                    </ContextMenu.Item>
                  ))}
                </ContextMenu.SubContent>
              </ContextMenu.Portal>
            </ContextMenu.Sub>
          )}
          <ContextMenu.Separator className="my-1 h-px bg-zinc-700" />
          <ContextMenu.Item
            className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-red-400 outline-none hover:bg-red-500/20 hover:text-red-300 data-[highlighted]:bg-red-500/20 data-[highlighted]:text-red-300"
            onSelect={() => onDelete()}
          >
            <Trash2 size={14} strokeWidth={1.5} />
            Excluir tarefa
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
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