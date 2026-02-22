import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { api } from "../lib/api";
import { useSound, isValidReminderSound } from "../hooks/useSound";

export interface ReminderTask {
  id: number;
  title: string;
  reminder_at: string | null;
  due_date?: string | null;
  status?: string;
  sound?: string | null;
  custom_sound?: string | null;
}

interface ReminderContextValue {
  activeReminder: ReminderTask | null;
  triggerReminder: (task: ReminderTask) => void;
  dismissReminder: () => void;
  openTaskById: (id: number) => void;
  clearShownId: (id: number) => void;
}

const ReminderContext = createContext<ReminderContextValue | null>(null);

export function useReminder() {
  const ctx = useContext(ReminderContext);
  if (!ctx) throw new Error("useReminder must be used within ReminderProvider");
  return ctx;
}

interface ReminderProviderProps {
  children: ReactNode;
  reminderSound?: string | null;
}

const POLL_INTERVAL_MS = 30_000;

export function ReminderProvider({ children, reminderSound = null }: ReminderProviderProps) {
  const [activeReminder, setActiveReminder] = useState<ReminderTask | null>(null);
  const shownIdsRef = useRef<Set<number>>(new Set());
  const navigate = useNavigate();
  const { play } = useSound();

  const triggerReminder = useCallback(
    (task: ReminderTask) => {
      setActiveReminder(task);
      // Prioridade: som da tarefa (sound/custom_sound) > som padrão global > chimes1
      const sound =
        task.sound ||
        (task.custom_sound && isValidReminderSound(task.custom_sound) ? task.custom_sound : null) ||
        (isValidReminderSound(reminderSound) ? reminderSound : null) ||
        "chimes1";
      play(sound);
      window.dispatchEvent(new CustomEvent("reminder-triggered"));
    },
    [play, reminderSound]
  );

  const dismissReminder = useCallback(() => {
    setActiveReminder(null);
  }, []);

  const openTaskById = useCallback(
    async (id: number) => {
      navigate("/administrativo", { state: { openTaskId: id } });
      const task = await api.getTask(id);
      if (task) {
        (window as unknown as { __pendingReminderTask?: ReminderTask }).__pendingReminderTask = task;
        window.dispatchEvent(new CustomEvent("reminder-open-task", { detail: task }));
      }
      dismissReminder();
    },
    [navigate, dismissReminder]
  );

  const clearShownId = useCallback((id: number) => {
    shownIdsRef.current.delete(id);
  }, []);

  useEffect(() => {
    (window as unknown as { triggerReminder?: (t: ReminderTask) => void }).triggerReminder = triggerReminder;
    return () => {
      delete (window as unknown as { triggerReminder?: (t: ReminderTask) => void }).triggerReminder;
    };
  }, [triggerReminder]);

  useEffect(() => {
    const poll = async () => {
      try {
        const due = await api.getRemindersDue();
        for (const t of due as ReminderTask[]) {
          if (t.id && !shownIdsRef.current.has(t.id)) {
            shownIdsRef.current.add(t.id);
            triggerReminder(t);
            break;
          }
        }
      } catch {
        // Ignore
      }
    };
    const id = setInterval(poll, POLL_INTERVAL_MS);
    poll();
    return () => clearInterval(id);
  }, [triggerReminder]);


  const value: ReminderContextValue = {
    activeReminder,
    triggerReminder,
    dismissReminder,
    openTaskById,
    clearShownId,
  };

  return (
    <ReminderContext.Provider value={value}>
      {children}
      <ReminderToast />
    </ReminderContext.Provider>
  );
}

function ReminderToast() {
  const { activeReminder, dismissReminder, openTaskById, clearShownId } = useReminder();
  const [postponing, setPostponing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handlePostpone = async (
    taskId: number,
    payload: { minutes?: number; hours?: number; tomorrow?: boolean }
  ) => {
    setPostponing(true);
    setMenuOpen(false);
    try {
      await api.reminderPostpone(taskId, payload);
      clearShownId(taskId);
      window.dispatchEvent(new CustomEvent("reminder-updated", { detail: { taskId } }));
      dismissReminder();
    } catch (e) {
      console.error(e);
    } finally {
      setPostponing(false);
    }
  };

  const handleIgnore = async () => {
    if (!activeReminder) return;
    try {
      await api.updateTask(activeReminder.id, { reminder_at: "" });
      clearShownId(activeReminder.id);
      window.dispatchEvent(new CustomEvent("reminder-updated", { detail: { taskId: activeReminder.id } }));
      dismissReminder();
    } catch (e) {
      console.error(e);
    }
  };

  const menuItems: { label: string; payload: { minutes?: number; hours?: number; tomorrow?: boolean } }[] = [
    { label: "10 min", payload: { minutes: 10 } },
    { label: "30 min", payload: { minutes: 30 } },
    { label: "1 hora", payload: { hours: 1 } },
    { label: "Amanhã", payload: { tomorrow: true } },
  ];

  return (
    <AnimatePresence>
      {activeReminder && (
      <motion.div
        key={activeReminder.id}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="fixed bottom-6 right-6 z-[9999] w-[380px] rounded-2xl border border-white/[0.08] bg-white/90 p-4 shadow-2xl backdrop-blur-xl dark:bg-zinc-900/90 dark:border-white/[0.06]"
      >
        {/* Título clicável */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => openTaskById(activeReminder.id)}
            className="min-w-0 flex-1 text-left"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
              Lembrete
            </p>
            <p className="mt-0.5 text-[15px] font-bold leading-snug text-slate-900 transition-colors hover:text-indigo-600 dark:text-zinc-100 dark:hover:text-indigo-400">
              {activeReminder.title}
            </p>
          </button>
          <button
            type="button"
            onClick={handleIgnore}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Fechar"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Linha de ações: Split-Button | Ignorar */}
        <div className="flex w-full items-center gap-3">
            {/* Split-Button: Lembrar em 5 min | ▼ */}
            <div className="flex min-w-0 flex-1 overflow-hidden rounded-xl border border-indigo-500/40 bg-indigo-500 shadow-sm">
              <button
                type="button"
                disabled={postponing}
                onClick={() => handlePostpone(activeReminder.id, { minutes: 5 })}
                className="flex-1 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
              >
                Lembrar em 5 min
              </button>
              <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    disabled={postponing}
                    className="flex items-center justify-center border-l border-indigo-400/50 px-2 py-2 text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
                    aria-label="Mais opções"
                  >
                    <ChevronDown size={14} strokeWidth={2} className={menuOpen ? "rotate-180" : ""} />
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    sideOffset={6}
                    align="end"
                    className="z-[10000] min-w-[120px] rounded-xl border border-slate-200/60 bg-white p-1 shadow-lg dark:border-white/[0.08] dark:bg-zinc-900"
                  >
                    {menuItems.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => handlePostpone(activeReminder.id, item.payload)}
                        className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        {item.label}
                      </button>
                    ))}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </div>

            <button
              type="button"
              onClick={handleIgnore}
              className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              Ignorar
            </button>
        </div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
