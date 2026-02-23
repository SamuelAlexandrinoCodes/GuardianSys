import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Trash2, X, Search } from "lucide-react";
import type { Task } from "../../types";

/* ========================================================================== */
/* CompletedRow                                                               */
/* ========================================================================== */

export interface CompletedRowProps {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
}

export function CompletedRow({ task, onToggle, onDelete }: CompletedRowProps) {
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

export interface HistoryOverlayProps {
  open: boolean;
  onClose: () => void;
  completed: Task[];
  onToggle: (task: Task) => void;
  onDelete: (taskId: number) => void;
}

export function HistoryOverlay({
  open,
  onClose,
  completed,
  onToggle,
  onDelete,
}: HistoryOverlayProps) {
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const filtered = completed.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
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
                      ? new Date(dateKey + "T00:00:00").toLocaleDateString("pt-BR", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
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
