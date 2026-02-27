import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ========================================================================== */
/* TaskConfirmModals                                                          */
/* ========================================================================== */

export interface TaskConfirmModalsProps {
  confirmDeleteTask: number | null;
  confirmDeleteList: number | null;
  onCancelTask: () => void;
  onConfirmTask: () => void;
  onCancelList: () => void;
  onConfirmList: () => void;
}

export function TaskConfirmModals({
  confirmDeleteTask,
  confirmDeleteList,
  onCancelTask,
  onConfirmTask,
  onCancelList,
  onConfirmList,
}: TaskConfirmModalsProps) {
  const cancelTaskRef = useRef<HTMLButtonElement>(null);
  const confirmTaskRef = useRef<HTMLButtonElement>(null);
  const cancelListRef = useRef<HTMLButtonElement>(null);
  const confirmListRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirmDeleteTask) return;
    const t = setTimeout(() => confirmTaskRef.current?.focus(), 0);
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancelTask();
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
  }, [confirmDeleteTask, onCancelTask]);

  useEffect(() => {
    if (!confirmDeleteList) return;
    const t = setTimeout(() => confirmListRef.current?.focus(), 0);
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancelList();
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
  }, [confirmDeleteList, onCancelList]);

  return (
    <>
      <AnimatePresence>
        {confirmDeleteTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            onClick={onCancelTask}
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
                  onClick={onCancelTask}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  ref={confirmTaskRef}
                  type="button"
                  onClick={onConfirmTask}
                  className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDeleteList && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            onClick={onCancelList}
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
                Atenção: excluir esta lista removerá permanentemente todas as
                tarefas contidas nela.
              </p>
              <div className="flex gap-3">
                <button
                  ref={cancelListRef}
                  type="button"
                  onClick={onCancelList}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  ref={confirmListRef}
                  type="button"
                  onClick={onConfirmList}
                  className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
