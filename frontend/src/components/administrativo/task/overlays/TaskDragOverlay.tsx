import {
  Archive,
  CalendarDays,
  Bell,
  Repeat,
} from "lucide-react";
import type { Task } from "../../../../types";
import { colorHexMap } from "../helpers/taskHelpers";

export interface TaskDragOverlayProps {
  task: Task;
  isOverBubbleZone: boolean;
}

/** Clone visual da TaskRow — card COMPLETO, mesmo tamanho e conteúdo da tarefa real */
function TaskCardClone({ task }: { task: Task }) {
  const today = new Date().toISOString().split("T")[0];
  const isOverdue = task.status === "PENDENTE" && task.due_date && task.due_date < today;

  return (
    <div
      className="pointer-events-none min-w-[320px] w-full max-w-[calc(100vw-48px)] rounded-2xl border border-slate-200/60 bg-white dark:border-white/[0.06] dark:bg-zinc-900"
      style={{
        borderLeftWidth: 5,
        borderLeftColor: task.color ? (colorHexMap[task.color] ?? "transparent") : "transparent",
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.05)",
        transform: "scale(1.02) rotate(1.5deg)",
        transition: "transform 0.15s cubic-bezier(0.2, 0, 0, 1)"
      }}
    >
      <div className="relative flex items-start gap-2.5 px-4 py-2.5">
        <div className="mt-0.5 h-[16px] w-[16px] shrink-0 rounded-full border-[1.5px] border-slate-300 dark:border-zinc-600" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-snug tracking-tight text-slate-900 dark:text-zinc-100 break-words">
            {task.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {task.due_date && (
              <span
                className={`flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                  isOverdue
                    ? "text-red-500 dark:text-red-400"
                    : "text-slate-400 dark:text-zinc-500"
                }`}
              >
                <CalendarDays size={9} strokeWidth={1.5} />
                {new Date(task.due_date + "T00:00:00").toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                })}
                {isOverdue && <span className="font-bold">ATRASADO</span>}
              </span>
            )}
            {task.reminder_at && (
              <span className="flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider text-blue-400 dark:text-blue-500">
                <Bell size={9} strokeWidth={1.5} />
                {new Date(task.reminder_at).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </span>
            )}
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
            {task.steps && task.steps.length > 0 && (
              <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                {task.steps.filter((s) => s.done).length}/{task.steps.length} passos
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const PILL_WIDTH = 140;
const PILL_HEIGHT = 32;

/** Pílula usada quando a tarefa está sobre a zona de bolhas (posição controlada pelo modificador no TaskBoard) */
function TaskPillClone({ task }: { task: Task }) {
  const firstWord = task.title.trim().split(/\s+/)[0] || task.title;
  const pillLabel = firstWord ? `${firstWord}...` : "Mover";

  return (
    <div
      className="pointer-events-none flex items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-800"
      style={{
        width: PILL_WIDTH,
        height: PILL_HEIGHT,
        boxShadow: "0 20px 40px -8px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.1)",
      }}
    >
      <div className="flex w-full items-center justify-center gap-1.5 px-3 text-zinc-300">
        <Archive size={14} strokeWidth={2.5} className="shrink-0" />
        <span className="truncate text-[11px] font-bold tracking-widest uppercase">
          {pillLabel}
        </span>
      </div>
    </div>
  );
}

export function TaskDragOverlay({ task, isOverBubbleZone }: TaskDragOverlayProps) {
  if (isOverBubbleZone) {
    return <TaskPillClone task={task} />;
  }
  return (
    <div
      className="pointer-events-none"
      style={{
        width: "max-content",
        minWidth: 320,
        maxWidth: "calc(100vw - 48px)",
      }}
    >
      <TaskCardClone task={task} />
    </div>
  );
}
