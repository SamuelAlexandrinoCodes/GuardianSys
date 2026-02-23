import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import * as ColorPopover from "@radix-ui/react-popover";
import {
  Plus,
  ChevronDown,
  ChevronUp,
  History,
  Sparkles,
  CalendarDays,
  Bell,
  Repeat,
  Calendar,
  Clock,
  Sun,
  Zap,
  Archive,
  Trash2,
} from "lucide-react";
import type { Task, TaskStep } from "../../types";
import { api } from "../../lib/api";
import { TaskSideSheet } from "./TaskSideSheet";
import { MiniCalendar } from "../ui/MiniCalendar";
import { Time24Input } from "../ui/Time24Input";
import { BubbleRow } from "./BubbleRow";
import { TaskRow } from "./TaskRow";
import { HistoryOverlay, CompletedRow } from "./HistoryOverlay";
import {
  colorHexMap,
  parseSmartInput,
  isReminderInPast,
  emptyMeta,
  type QuickMeta,
  type TaskFilterValue,
  loadBubbleOrder,
  BUBBLE_ORDER_KEY,
  repeatOptions,
  pad2,
} from "./taskHelpers";

/* ========================================================================== */
/* DragOverlayTask â€” Coreografia Pixar: tamanho primeiro, estilo depois       */
/* ========================================================================== */

function DragOverlayTask({
  task,
  isOverBubbleZone,
  colorHexMap,
}: {
  task: Task;
  isOverBubbleZone: boolean;
  colorHexMap: Record<string, string>;
}) {
  const firstWord = task.title.trim().split(/\s+/)[0] || task.title;
  const pillLabel = firstWord ? `${firstWord}...` : "Mover";

  return (
    // [DEBUG] motion.div substituído por div estática para isolar comportamento do DnD
    <div className="flex items-center justify-center pointer-events-none" style={{ width: 140, height: 40 }}>
      <div
        className={`overflow-hidden shadow-2xl pointer-events-none ${
          isOverBubbleZone
            ? "rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center"
            : "rounded-2xl border border-slate-200/60 bg-white dark:border-white/[0.06] dark:bg-zinc-900"
        }`}
        style={{
          width: isOverBubbleZone ? 140 : 400,
          height: isOverBubbleZone ? 32 : "auto",
          opacity: 0.95,
          borderLeftWidth: isOverBubbleZone ? 0 : 5,
          borderLeftColor: !isOverBubbleZone && task.color ? (colorHexMap[task.color] ?? "transparent") : "transparent",
        }}
      >
        {isOverBubbleZone ? (
          <div className="flex w-full items-center justify-center gap-1.5 px-3 text-zinc-300">
            <Archive size={14} strokeWidth={2.5} className="shrink-0" />
            <span className="truncate text-[11px] font-bold tracking-widest uppercase">
              {pillLabel}
            </span>
          </div>
        ) : (
          <div className="flex w-[400px] items-center gap-3 px-5 py-4">
            <div className="h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] border-slate-300 dark:border-zinc-600" />
            <p className="truncate text-[15px] font-semibold leading-snug tracking-tight text-slate-900 dark:text-zinc-100">
              {task.title}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* StaticActionButton â€” Quick Add toolbar                                     */
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
/* Props (TaskFilterValue re-exported for AdministrativoPage)                 */
/* ========================================================================== */

export type { TaskFilterId, TaskFilterValue } from "./taskHelpers";

export interface TaskBoardProps {
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

  // --- MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚ÂGICA EM TEMPO REAL (O Erro vermelho foi resolvido aqui) ---
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

  // Atualizar ao montar (quando o usuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio abre a aba de tarefas)
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

  // Atualizar lista quando notificaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de lembrete for disparada (ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cone some do card)
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

  // Data de inÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cio: auto-selecionar hoje ao abrir o popover
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
      { id: "tomorrow" as const, label: "AmanhÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£", date: tomorrowStr, sub: fmt(tomorrow) },
      { id: "nextweek" as const, label: "PrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³xima Semana", date: nextMonStr, sub: fmt(nextMon) },
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
      { id: "tomorrow" as const, label: "AmanhÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£", sub: `${fmt(tomorrow)}, 09:00`, icon: Sun, date: tomorrowStr, time: "09:00" },
      { id: "nextweek" as const, label: "PrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³xima semana", sub: `${fmt(nextMon)}, 09:00`, icon: Calendar, date: nextMonStr, time: "09:00" },
    ];
  })();

  const todayCompleted = completed
    .filter((t) => t.completed_at && t.completed_at.startsWith(todayStr))
    .sort((a, b) => {
      const aAt = a.completed_at || "";
      const bAt = b.completed_at || "";
      return bAt.localeCompare(aAt); // Mais recente primeiro (cronolÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³gico inverso)
    });

  /* ---- Handlers ---- */

  const handleQuickCreate = useCallback(async () => {
    const raw = quickInput.trim();
    if (!raw) return;

    const { title, reminderAt, dueDate } = parseSmartInput(raw);
    const payload: Record<string, unknown> = { title: title || raw };

    // Prioridade 1: BotÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes Manuais. Prioridade 2: InteligÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia do texto.
    if (quickMeta.dueDate) {
      payload.due_date = quickMeta.dueDate;
    } else if (dueDate) {
      payload.due_date = dueDate.split("T")[0];
    }
    // Data de inÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cio: Bubble "Meu Dia" forÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§a hoje; "AtribuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­do a mim" forÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§a amanhÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£
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
    // AtribuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­do a Mim (planejado): atributo fixo ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â NUNCA removido por Meu Dia ou Importante
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
        // NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o altera is_assigned ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â tarefa continua em "AtribuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­do a Mim" se jÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ estava
      } else if (bubbleId === "importante") {
        payload.is_important = true;
      } else if (bubbleId === "geral") {
        // Nenhuma aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â apenas troca a visÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o para Geral
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
      // null/undefined -> "" para o backend Pydantic reconhecer a limpeza (null e ignorado)
      await api.updateTask(taskId, { color: color ?? "" });
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
      // Apenas altera start_date; Nao altera is_assigned - tarefa continua em "Atribuido a Mim"
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

  // Atalhos globais: Ctrl+T (Meu Dia), Ctrl+D (Concluir) ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â quando SideSheet aberta
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
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
      <div className="flex h-full flex-col">
        {/* ---------------------------------------------------------------- */}
        {/* Quick-add input ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â hierarquia dupla (tooltips vs popovers)          */}
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
              {/* InÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cio */}
              <StaticActionButton
                icon={Zap}
                label="Data de InÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cio"
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

              {/* Tooltip ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â acima dos botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes (side: top), largura exata do buttonGroupRef */}
              {hoveredQuickAction && (
                <div className="absolute bottom-full left-0 right-0 z-10 mb-1 flex w-full items-center justify-center rounded-lg bg-slate-800 py-1.5 text-[11px] font-medium text-white shadow-lg dark:bg-zinc-700">
                  {hoveredQuickAction === "start" && "Data de InÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cio"}
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
                {/* InÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cio ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Data de InÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cio (padrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o: hoje, sem botÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o Limpar) */}
                {activePopover === "start" && (
                  <div className="space-y-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Zap size={14} strokeWidth={1.5} className="text-indigo-500" />
                      <span className="text-xs font-bold tracking-tight text-slate-800 dark:text-zinc-200">
                        Data de InÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cio
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

                {/* Entrega ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â presets primeiro; "Escolher data" revela MiniCalendar */}
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

                {/* Lembrete ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â presets primeiro; "Escolher data e hora" revela MiniCalendar + HorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio */}
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
                            HorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio (24h)
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
                        Limpar repetiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o
                      </button>
                    )}
                  </div>
                )}
              </ColorPopover.Content>
            </ColorPopover.Portal>
          </ColorPopover.Root>

          {/* Bubbles ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â filtros arrastÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡veis */}
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
        {/* Pending tasks ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â sortable via press-to-drag                       */}
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

      <DragOverlay modifiers={[snapCenterToCursor]} style={{ pointerEvents: "none" }}>
        {activeDragId ? (() => {
          const task = pending.find((t) => t.id === activeDragId) || completed.find((t) => t.id === activeDragId);
          if (!task) return null;

          // Detecta se o cursor estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ sobre a zona das Bubbles (pointerWithin garante detecÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o precisa)
          const isOverBubbleZone = dragOverId?.startsWith("bubble-") || dragOverId === "drop-bubble-zone";

          // Primeira palavra + "..." para o estado pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­lula
          return (
            <DragOverlayTask
              task={task}
              isOverBubbleZone={isOverBubbleZone}
              colorHexMap={colorHexMap}
            />
          );
        })() : null}
      </DragOverlay>
      </DndContext>

      {/* Modal: confirmar exclusao de tarefa */}
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

      {/* Modal: confirmar exclusao de lista */}
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
                AtenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o: excluir esta lista removerÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ permanentemente todas as tarefas contidas nela.
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
