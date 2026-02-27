import { useState, useRef, useCallback, useEffect, useLayoutEffect, forwardRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as ColorPopover from "@radix-ui/react-popover";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Trash2,
  CalendarDays,
  Bell,
  Repeat,
  Plus,
  Palette,
  Sun,
  Star,
} from "lucide-react";
import type { Task, TaskStep } from "../../../types";
import { colorHexMap, colorOptions } from "./helpers/taskHelpers";
import { TaskContextMenu } from "./TaskContextMenu";

/* ========================================================================== */
/* TooltipButton                                                              */
/* ========================================================================== */

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

  const tooltipEl =
    hovered && rect && typeof document !== "undefined"
      ? createPortal(
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
        )
      : null;

  return (
    <>
      <button
        ref={setRefs}
        type="button"
        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${className}`}
        aria-label={label}
        onMouseEnter={() => {
          setHovered(true);
          updateRect();
        }}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {children}
      </button>
      {tooltipEl}
    </>
  );
});

/* ========================================================================== */
/* TaskRow                                                                    */
/* ========================================================================== */

export interface TaskRowProps {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onClick: () => void;
  onTitleChange: (task: Task, newTitle: string) => void | Promise<void>;
  onImportantToggle: () => void;
  onMyDayAdd: () => void;
  onSetStartDate: (date: string | null) => void;
  onMoveToList: (listId: number | null) => void;
  onAddStep: (task: Task, title: string) => void;
  onToggleStep: (task: Task, step: TaskStep) => void;
  onDeleteStep: (task: Task, stepId: number) => void;
  onColorChange: (color: string | null) => void;
  lists: { id: number; name: string }[];
  hideGhostWhenOverBubbles?: boolean;
  isInGroup?: boolean;
}

export function TaskRow({
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
  hideGhostWhenOverBubbles = false,
  isInGroup = false,
}: TaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
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
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [dragRect, setDragRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      (rowRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      setNodeRef(el);
    },
    [setNodeRef]
  );

  useLayoutEffect(() => {
    if (isDragging && rowRef.current) {
      const rect = rowRef.current.getBoundingClientRect();
      setDragRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    } else {
      setDragRect(null);
    }
  }, [isDragging]);

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
    transition: "none",
    borderLeftWidth: 5,
    borderLeftColor: task.color ? (colorHexMap[task.color] ?? "transparent") : "transparent",
    ...(isDragging &&
      dragRect && {
        position: "fixed",
        top: dragRect.top,
        left: dragRect.left,
        width: dragRect.width,
        height: dragRect.height,
        zIndex: 9999,
      }),
  };

  const rowContent = (
    <div
      ref={setRefs}
      style={{
        ...sortableStyle,
        ...(isDragging && hideGhostWhenOverBubbles && { visibility: "hidden" as const }),
      }}
      {...attributes}
      {...listeners}
      className={`group overflow-hidden rounded-2xl border border-slate-200/60 shadow-sm transition-shadow select-none dark:border-white/[0.06] hover:shadow-md ${
        isInGroup
          ? "bg-indigo-50/60 dark:bg-indigo-950/30"
          : "bg-white dark:bg-zinc-900"
      } ${isDragging && !hideGhostWhenOverBubbles ? "opacity-95 shadow-xl" : ""}`}
    >
      <div
        className="relative flex items-start gap-2.5 px-4 py-2.5"
        onClick={onClick}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="mt-0.5 flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-slate-300 transition-colors hover:border-indigo-500 dark:border-zinc-600 dark:hover:border-indigo-400"
        />

        <div className="min-w-0 flex-1">
          <div onClick={(e) => e.stopPropagation()} className="w-fit max-w-full">
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
                    if (e.key === "Enter") e.currentTarget.blur();
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
            {task.due_date &&
              (() => {
                const today = new Date().toISOString().split("T")[0];
                const isOverdue = task.status === "PENDENTE" && task.due_date < today;
                return (
                  <span
                    className={`flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                      isOverdue ? "text-red-500 dark:text-red-400" : "text-slate-400 dark:text-zinc-500"
                    }`}
                  >
                    <CalendarDays size={9} strokeWidth={1.5} />
                    {new Date(task.due_date + "T00:00:00").toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                    })}
                    {isOverdue && <span className="font-bold">ATRASADO</span>}
                  </span>
                );
              })()}
            {task.reminder_at &&
              (() => {
                const d = new Date(task.reminder_at);
                const today = new Date();
                const isToday = d.toDateString() === today.toDateString();
                const timeStr = d.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                });
                const label = isToday
                  ? timeStr
                  : `${d.getDate()} ${d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()}, ${timeStr}`;
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
                        <Check size={6} strokeWidth={3} className="text-white" />
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
                      const newColor = task.color === c.value ? null : c.value;
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
                    await onColorChange(null);
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
  );

  return (
    <TaskContextMenu
      task={task}
      lists={lists}
      onMyDayAdd={onMyDayAdd}
      onImportantToggle={onImportantToggle}
      onToggle={onToggle}
      onSetStartDate={onSetStartDate}
      onMoveToList={onMoveToList}
      onDelete={onDelete}
      onOpenSideSheet={onClick}
    >
      <div
        className="mb-1.5"
        style={isDragging && dragRect ? { minHeight: dragRect.height } : undefined}
      >
        {isDragging && dragRect && (
          <div style={{ height: dragRect.height }} aria-hidden />
        )}
        {rowContent}
      </div>
    </TaskContextMenu>
  );
}
