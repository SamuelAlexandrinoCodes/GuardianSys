import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DragDropContext,
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";
import type { DropResult, DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import * as ColorPopover from "@radix-ui/react-popover";
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
  GripVertical,
  Palette,
  X,
  Search,
} from "lucide-react";
import type { Task, TaskStep } from "../../types";
import { api } from "../../lib/api";
import { TaskSideSheet } from "./TaskSideSheet";

/* ========================================================================== */
/* Constants                                                                   */
/* ========================================================================== */

const colorMap: Record<string, string> = {
  "border-l-red-500": "border-l-red-500",
  "border-l-orange-500": "border-l-orange-500",
  "border-l-emerald-500": "border-l-emerald-500",
  "border-l-blue-500": "border-l-blue-500",
  "border-l-purple-500": "border-l-purple-500",
};

const colorOptions = [
  { value: "border-l-red-500", bg: "bg-red-500" },
  { value: "border-l-orange-500", bg: "bg-orange-500" },
  { value: "border-l-emerald-500", bg: "bg-emerald-500" },
  { value: "border-l-blue-500", bg: "bg-blue-500" },
  { value: "border-l-purple-500", bg: "bg-purple-500" },
];

function getBorderColor(color: string | null): string {
  if (!color) return "border-l-transparent";
  return colorMap[color] || "border-l-transparent";
}

/* ========================================================================== */
/* Quick Action Meta                                                           */
/* ========================================================================== */

interface QuickMeta {
  dueDate: string;
  reminderDate: string;
  reminderTime: string;
  repeat: string;
  repeatDays: number | "";
}

const emptyMeta: QuickMeta = {
  dueDate: "",
  reminderDate: "",
  reminderTime: "",
  repeat: "NONE",
  repeatDays: "",
};

/* ========================================================================== */
/* Props                                                                       */
/* ========================================================================== */

interface TaskBoardProps {
  pending: Task[];
  completed: Task[];
  onRefresh: () => void;
}

/* ========================================================================== */
/* TaskBoard                                                                   */
/* ========================================================================== */

export function TaskBoard({ pending, completed, onRefresh }: TaskBoardProps) {
  const [quickInput, setQuickInput] = useState("");
  const [quickMeta, setQuickMeta] = useState<QuickMeta>(emptyMeta);
  const [activePopover, setActivePopover] = useState<
    "date" | "reminder" | "repeat" | null
  >(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverAreaRef = useRef<HTMLDivElement>(null);

  // Keep activeTask in sync with refreshed data
  useEffect(() => {
    if (!activeTask) return;
    const id = activeTask.id;
    const updated = [...pending, ...completed].find((t) => t.id === id);
    if (updated) setActiveTask(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, completed]);

  const todayStr = new Date().toISOString().split("T")[0];
  const todayCompleted = completed.filter(
    (t) => t.completed_at && t.completed_at.startsWith(todayStr)
  );

  // Close popover on outside click
  useEffect(() => {
    if (!activePopover) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverAreaRef.current &&
        !popoverAreaRef.current.contains(e.target as Node)
      ) {
        setActivePopover(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [activePopover]);

  /* ---- Handlers ---- */

  const handleQuickCreate = useCallback(async () => {
    const title = quickInput.trim();
    if (!title) return;
    const payload: Record<string, unknown> = { title };
    if (quickMeta.dueDate) payload.due_date = quickMeta.dueDate;
    if (quickMeta.reminderDate && quickMeta.reminderTime) {
      payload.reminder_at = `${quickMeta.reminderDate}T${quickMeta.reminderTime}`;
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
  }, [quickInput, quickMeta, onRefresh]);

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      if (
        !result.destination ||
        result.source.index === result.destination.index
      )
        return;
      const reordered = Array.from(pending);
      const [moved] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, moved);
      await api.reorderTasks(reordered.map((t) => t.id));
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

  const hasDate = !!quickMeta.dueDate;
  const hasReminder = !!(quickMeta.reminderDate && quickMeta.reminderTime);
  const hasRepeat = quickMeta.repeat !== "NONE";

  return (
    <>
      <div className="flex h-full flex-col">
        {/* ---------------------------------------------------------------- */}
        {/* Quick-add input                                                   */}
        {/* ---------------------------------------------------------------- */}
        <div className="shrink-0 px-6 pt-6 pb-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm transition-shadow focus-within:shadow-md dark:border-white/[0.06] dark:bg-zinc-900">
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
                placeholder="Nova tarefa..."
                className="flex-1 bg-transparent text-[15px] font-semibold tracking-tight text-slate-900 placeholder-slate-300 outline-none dark:text-zinc-100 dark:placeholder-zinc-600"
              />
            </div>

            {/* Quick action buttons + popovers */}
            <div
              ref={popoverAreaRef}
              className="relative flex gap-1 border-t border-slate-100/80 px-4 py-2 dark:border-white/[0.04]"
            >
              {/* Date */}
              <button
                onClick={() =>
                  setActivePopover(activePopover === "date" ? null : "date")
                }
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] transition-colors ${
                  hasDate
                    ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                    : "text-slate-400 hover:bg-slate-50 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-400"
                }`}
              >
                <CalendarDays size={12} strokeWidth={1.5} />
                {hasDate
                  ? new Date(
                      quickMeta.dueDate + "T00:00:00"
                    ).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                    })
                  : "Data"}
              </button>

              {/* Reminder */}
              <button
                onClick={() =>
                  setActivePopover(
                    activePopover === "reminder" ? null : "reminder"
                  )
                }
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] transition-colors ${
                  hasReminder
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                    : "text-slate-400 hover:bg-slate-50 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-400"
                }`}
              >
                <Bell size={12} strokeWidth={1.5} />
                {hasReminder ? quickMeta.reminderTime : "Lembrete"}
              </button>

              {/* Repeat */}
              <button
                onClick={() =>
                  setActivePopover(
                    activePopover === "repeat" ? null : "repeat"
                  )
                }
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] transition-colors ${
                  hasRepeat
                    ? "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
                    : "text-slate-400 hover:bg-slate-50 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-400"
                }`}
              >
                <Repeat size={12} strokeWidth={1.5} />
                {hasRepeat
                  ? quickMeta.repeat === "DAILY"
                    ? "Diario"
                    : quickMeta.repeat === "WEEKLY"
                      ? "Semanal"
                      : quickMeta.repeat === "MONTHLY"
                        ? "Mensal"
                        : `${quickMeta.repeatDays}d`
                  : "Repetir"}
              </button>

              {/* ---- Popovers ---- */}
              <AnimatePresence>
                {activePopover === "date" && (
                  <PopoverPanel key="pop-date">
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
                      Data de entrega
                    </label>
                    <input
                      type="date"
                      autoFocus
                      value={quickMeta.dueDate}
                      onChange={(e) =>
                        setQuickMeta({ ...quickMeta, dueDate: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-200/60 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300"
                    />
                    {quickMeta.dueDate && (
                      <button
                        onClick={() =>
                          setQuickMeta({ ...quickMeta, dueDate: "" })
                        }
                        className="mt-1.5 text-[10px] font-semibold text-red-400 hover:text-red-500"
                      >
                        Limpar
                      </button>
                    )}
                  </PopoverPanel>
                )}

                {activePopover === "reminder" && (
                  <PopoverPanel key="pop-reminder">
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-500 dark:text-blue-400">
                      Lembrete
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        autoFocus
                        value={quickMeta.reminderDate}
                        onChange={(e) =>
                          setQuickMeta({
                            ...quickMeta,
                            reminderDate: e.target.value,
                          })
                        }
                        className="rounded-lg border border-slate-200/60 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300"
                      />
                      <input
                        type="time"
                        value={quickMeta.reminderTime}
                        onChange={(e) =>
                          setQuickMeta({
                            ...quickMeta,
                            reminderTime: e.target.value,
                          })
                        }
                        className="rounded-lg border border-slate-200/60 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300"
                      />
                    </div>
                    {(quickMeta.reminderDate || quickMeta.reminderTime) && (
                      <button
                        onClick={() =>
                          setQuickMeta({
                            ...quickMeta,
                            reminderDate: "",
                            reminderTime: "",
                          })
                        }
                        className="mt-1.5 text-[10px] font-semibold text-red-400 hover:text-red-500"
                      >
                        Limpar
                      </button>
                    )}
                  </PopoverPanel>
                )}

                {activePopover === "repeat" && (
                  <PopoverPanel key="pop-repeat">
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-500 dark:text-orange-400">
                      Repetir
                    </label>
                    <select
                      autoFocus
                      value={quickMeta.repeat}
                      onChange={(e) =>
                        setQuickMeta({
                          ...quickMeta,
                          repeat: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200/60 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      <option value="NONE">Nao repete</option>
                      <option value="DAILY">Diariamente</option>
                      <option value="WEEKLY">Semanalmente</option>
                      <option value="MONTHLY">Mensalmente</option>
                      <option value="CUSTOM">A cada X dias</option>
                    </select>
                    {quickMeta.repeat === "CUSTOM" && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={quickMeta.repeatDays}
                          onChange={(e) =>
                            setQuickMeta({
                              ...quickMeta,
                              repeatDays: parseInt(e.target.value) || "",
                            })
                          }
                          className="w-20 rounded-lg border border-slate-200/60 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300"
                          placeholder="Dias"
                        />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                          dias
                        </span>
                      </div>
                    )}
                  </PopoverPanel>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Pending tasks — scrollable with Drag & Drop                       */}
        {/* ---------------------------------------------------------------- */}
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none px-6 pb-2">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="pending-tasks">
              {(droppableProvided) => (
                <div
                  ref={droppableProvided.innerRef}
                  {...droppableProvided.droppableProps}
                >
                  {pending.map((task, index) => (
                    <Draggable
                      key={task.id}
                      draggableId={String(task.id)}
                      index={index}
                    >
                      {(dragProvided, snapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          style={dragProvided.draggableProps.style}
                          className="mb-2"
                        >
                          <TaskRow
                            task={task}
                            dragHandleProps={dragProvided.dragHandleProps}
                            isDragging={snapshot.isDragging}
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
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {droppableProvided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

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
        {/* Completed dock — fixed bottom                                     */}
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

      {/* Side Sheet */}
      <TaskSideSheet
        task={activeTask}
        onClose={() => setActiveTask(null)}
        onRefresh={onRefresh}
        onColorChange={handleColorChange}
      />

      {/* History Overlay */}
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
/* PopoverPanel                                                                */
/* ========================================================================== */

function PopoverPanel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-slate-200/60 bg-white p-3 shadow-lg dark:border-white/[0.08] dark:bg-zinc-900"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </motion.div>
  );
}

/* ========================================================================== */
/* TaskRow                                                                     */
/* ========================================================================== */

interface TaskRowProps {
  task: Task;
  dragHandleProps: DraggableProvidedDragHandleProps | null | undefined;
  isDragging: boolean;
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
  dragHandleProps,
  isDragging,
  onToggle,
  onDelete,
  onClick,
  onAddStep,
  onToggleStep,
  onDeleteStep,
  onColorChange,
}: TaskRowProps) {
  const [showStepInput, setShowStepInput] = useState(false);
  const [stepInput, setStepInput] = useState("");
  const [expanded, setExpanded] = useState(false);

  const hasSteps = task.steps && task.steps.length > 0;
  const doneSteps = task.steps?.filter((s) => s.done).length || 0;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-slate-200/60 border-l-[5px] bg-white shadow-sm transition-shadow dark:border-white/[0.06] dark:bg-zinc-900 ${getBorderColor(task.color)} ${
        isDragging
          ? "shadow-lg ring-2 ring-indigo-500/20"
          : "hover:shadow-md"
      }`}
    >
      <div
        className="relative flex items-start gap-3.5 px-5 py-4"
        onClick={onClick}
      >
        {/* Drag handle */}
        <div
          {...(dragHandleProps ?? {})}
          className="mt-1 shrink-0 cursor-grab text-slate-200 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing dark:text-zinc-700"
        >
          <GripVertical size={14} strokeWidth={1.5} />
        </div>

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

          {/* Meta chips */}
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
            {task.reminder_at && (
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-blue-400 dark:text-blue-500">
                <Bell size={10} strokeWidth={1.5} />
                Lembrete
              </span>
            )}
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
          {/* Color picker — Radix Portal (never clipped by overflow) */}
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
/* CompletedRow                                                                */
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
/* HistoryOverlay                                                              */
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
            {/* Header */}
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

            {/* Filters */}
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

            {/* List */}
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
