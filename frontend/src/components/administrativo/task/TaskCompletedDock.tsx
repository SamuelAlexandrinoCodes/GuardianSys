import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, History } from "lucide-react";
import type { Task } from "../../../types";
import { CompletedRow } from "../HistoryOverlay";

/* ========================================================================== */
/* TaskCompletedDock                                                          */
/* ========================================================================== */

export interface TaskCompletedDockProps {
  todayCompleted: Task[];
  onToggle: (task: Task) => void;
  onDelete: (taskId: number) => void;
  onShowHistory: () => void;
}

export function TaskCompletedDock({
  todayCompleted,
  onToggle,
  onDelete,
  onShowHistory,
}: TaskCompletedDockProps) {
  const [showCompleted, setShowCompleted] = useState(false);

  return (
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
              onShowHistory();
            }}
          >
            <History size={11} strokeWidth={1.5} />
            Histórico
          </button>
          {showCompleted ? (
            <ChevronUp size={14} className="text-slate-300 dark:text-zinc-600" />
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
                  onToggle={() => onToggle(task)}
                  onDelete={() => onDelete(task.id)}
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
  );
}
