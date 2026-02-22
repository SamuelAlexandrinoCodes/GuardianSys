import { useState, useEffect, useCallback } from "react";
import {
  Check,
  Plus,
  Trash2,
  CalendarDays,
  Bell,
  Repeat,
  FileText,
  Palette,
  Star,
} from "lucide-react";
import type { Task, TaskStep } from "../../types";
import { api } from "../../lib/api";
import { SideSheet } from "../ui/SideSheet";
import { Time24Input } from "../ui/Time24Input";

/** Retorna true se o DateTime (date YYYY-MM-DD + time HH:mm) for anterior ou igual a agora. */
function isReminderInPast(date: string, time: string): boolean {
  if (!date || !time || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{1,2}$/.test(time)) return false;
  const dt = new Date(`${date}T${time}:00`);
  return !isNaN(dt.getTime()) && dt.getTime() <= Date.now();
}

interface TaskSideSheetProps {
  task: Task | null;
  onClose: () => void;
  onRefresh: () => void;
  onColorChange?: (taskId: number, color: string | null) => void;
}

const colorOptions = [
  { value: "border-l-red-500", bg: "bg-red-500" },
  { value: "border-l-orange-500", bg: "bg-orange-500" },
  { value: "border-l-emerald-500", bg: "bg-emerald-500" },
  { value: "border-l-blue-500", bg: "bg-blue-500" },
  { value: "border-l-purple-500", bg: "bg-purple-500" },
];

export function TaskSideSheet({ task, onClose, onRefresh, onColorChange }: TaskSideSheetProps) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [details, setDetails] = useState("");
  const [reminder, setReminder] = useState<{ date: string; time: string }>({ date: "", time: "" });
  const [repeat, setRepeat] = useState("NONE");
  const [repeatDays, setRepeatDays] = useState<number | "">("");
  const [color, setColor] = useState<string | null>(null);
  const [isImportant, setIsImportant] = useState(false);
  const [stepInput, setStepInput] = useState("");
  const [reminderExpiredFeedback, setReminderExpiredFeedback] = useState(false);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setStartDate(task.start_date || "");
    setDueDate(task.due_date || "");
    setDetails(task.details || task.description || "");
    setRepeat(task.repeat || "NONE");
    setRepeatDays(task.repeat_interval_days || "");
    setColor(task.color);
    setIsImportant(task.is_important ?? false);

    if (task.reminder_at) {
      const [d, t] = task.reminder_at.split("T");
      setReminder({ date: d || "", time: t?.slice(0, 5) || "" });
    } else {
      setReminder({ date: "", time: "" });
    }
  }, [task]);

  // Autolimpeza: se lembrete selecionado estiver no passado, resetar
  useEffect(() => {
    const { date, time } = reminder;
    if (date && time && isReminderInPast(date, time)) {
      setReminder({ date: "", time: "" });
      setReminderExpiredFeedback(true);
      const t = setTimeout(() => setReminderExpiredFeedback(false), 3000);
      return () => clearTimeout(t);
    }
  }, [reminder.date, reminder.time]);

  const syncMeta = useCallback(
    async (overrides: Record<string, unknown> = {}) => {
      if (!task) return;
      const r = (overrides.reminder as { date: string; time: string } | undefined) ?? reminder;
      const reminderAt =
        r.date && r.time
          ? `${r.date}T${r.time}`
          : overrides.reminder !== undefined
            ? ""
            : task.reminder_at ?? "";
      await api.updateTask(task.id, {
        title: overrides.title ?? title,
        start_date: overrides.startDate ?? startDate,
        due_date: overrides.dueDate ?? dueDate,
        details: overrides.details ?? details,
        reminder_at: reminderAt,
        repeat: overrides.repeat ?? repeat,
        repeat_interval_days:
          (overrides.repeat ?? repeat) === "CUSTOM"
            ? (overrides.repeatDays ?? repeatDays) || null
            : null,
        color: overrides.color !== undefined ? overrides.color : color,
        is_important: overrides.is_important !== undefined ? overrides.is_important : isImportant,
      });
      onRefresh();
    },
    [task, title, startDate, dueDate, details, reminder, repeat, repeatDays, color, isImportant, onRefresh]
  );

  const persistReminder = useCallback(async () => {
    const { date, time } = reminder;
    if (date && time) {
      if (isReminderInPast(date, time)) {
        await syncMeta({ reminder: { date: "", time: "" } });
        setReminder({ date: "", time: "" });
        setReminderExpiredFeedback(true);
        setTimeout(() => setReminderExpiredFeedback(false), 3000);
      } else {
        await syncMeta({ reminder: { date, time } });
      }
    } else if (!date && !time && task?.reminder_at) {
      await syncMeta({ reminder: { date: "", time: "" } });
    }
  }, [reminder, task?.reminder_at, syncMeta]);

  const handleToggle = useCallback(async () => {
    if (!task) return;
    await api.toggleTask(task.id);
    onClose();
    onRefresh();
  }, [task, onClose, onRefresh]);

  const handleAddStep = useCallback(async () => {
    if (!task || !stepInput.trim()) return;
    await api.addStep(task.id, stepInput.trim());
    setStepInput("");
    onRefresh();
  }, [task, stepInput, onRefresh]);

  const handleToggleStep = useCallback(
    async (step: TaskStep) => {
      if (!task) return;
      await api.toggleStep(task.id, step.id);
      onRefresh();
    },
    [task, onRefresh]
  );

  const handleDeleteStep = useCallback(
    async (stepId: number) => {
      if (!task) return;
      await api.deleteStep(task.id, stepId);
      onRefresh();
    },
    [task, onRefresh]
  );

  const handleClose = useCallback(async () => {
    await persistReminder();
    onClose();
  }, [persistReminder, onClose]);

  if (!task) return null;

  return (
    <SideSheet open={!!task} onClose={handleClose} title="Detalhes da Tarefa">
      <div className="space-y-8 p-6">
        {/* Title + Toggle */}
        <div className="flex items-start gap-4">
          <button
            onClick={handleToggle}
            className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
              task.status === "CONCLUIDO"
                ? "border-emerald-400 bg-emerald-400 dark:border-emerald-500 dark:bg-emerald-500"
                : "border-slate-300 hover:border-indigo-500 dark:border-zinc-600 dark:hover:border-indigo-400"
            }`}
          >
            {task.status === "CONCLUIDO" && (
              <Check size={10} strokeWidth={3} className="text-white" />
            )}
          </button>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => syncMeta({ title })}
            className="flex-1 bg-transparent text-xl font-bold tracking-tight text-slate-900 outline-none dark:text-zinc-100"
          />
        </div>

        {/* Importante + Color picker */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              const next = !isImportant;
              setIsImportant(next);
              syncMeta({ is_important: next });
            }}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
              isImportant
                ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                : "bg-slate-50 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-700"
            }`}
          >
            <Star
              size={14}
              strokeWidth={1.5}
              className={isImportant ? "fill-amber-400 text-amber-400" : ""}
            />
            {isImportant ? "Importante" : "Marcar importante"}
          </button>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <Palette size={12} strokeWidth={1.5} className="text-slate-400 dark:text-zinc-500" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
              Cor
            </span>
          </div>
          <div className="flex gap-2">
            {colorOptions.map((c) => (
              <button
                key={c.value}
                onClick={async (e) => {
                  e.stopPropagation();
                  const currentColor = task?.color ?? color;
                  const newColor = currentColor === c.value ? "" : c.value;
                  setColor(newColor || null);
                  if (onColorChange && task) {
                    onColorChange(task.id, newColor);
                  } else if (task) {
                    await api.updateTask(task.id, { color: newColor });
                    onRefresh();
                  }
                }}
                className={`h-5 w-5 rounded-full transition-transform hover:scale-125 ${c.bg} ${
                  (task?.color ?? color) === c.value
                    ? "ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-zinc-900 dark:ring-zinc-500"
                    : ""
                }`}
              />
            ))}
            <button
              onClick={async (e) => {
                e.stopPropagation();
                setColor(null);
                if (onColorChange && task) {
                  onColorChange(task.id, "");
                } else if (task) {
                  await api.updateTask(task.id, { color: "" });
                  onRefresh();
                }
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-slate-300 text-[8px] text-slate-400 transition-transform hover:scale-125 dark:border-zinc-600 dark:text-zinc-600"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Steps */}
        <div>
          <div className="mb-3 flex items-center gap-1.5">
            <Check size={12} strokeWidth={1.5} className="text-slate-400 dark:text-zinc-500" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
              Subtarefas
            </span>
          </div>
          <div className="space-y-1 mb-3">
            {task.steps.map((step) => (
              <div
                key={step.id}
                className="group/step flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50"
              >
                <button
                  onClick={() => handleToggleStep(step)}
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
                    step.done
                      ? "border-indigo-500 bg-indigo-500 dark:border-indigo-400 dark:bg-indigo-400"
                      : "border-slate-300 dark:border-zinc-600"
                  }`}
                >
                  {step.done && <Check size={8} strokeWidth={3} className="text-white" />}
                </button>
                <span
                  className={`flex-1 text-[13px] font-medium transition-all ${
                    step.done
                      ? "text-slate-300 line-through dark:text-zinc-600"
                      : "text-slate-700 dark:text-zinc-300"
                  }`}
                >
                  {step.title}
                </span>
                <button
                  onClick={() => handleDeleteStep(step.id)}
                  className="text-slate-200 opacity-0 transition-opacity group-hover/step:opacity-100 hover:text-red-400 dark:text-zinc-700 dark:hover:text-red-400"
                >
                  <Trash2 size={12} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex min-h-[40px] items-center gap-2 px-2">
            <Plus size={14} strokeWidth={1.5} className="shrink-0 text-slate-300 dark:text-zinc-600" />
            <input
              type="text"
              value={stepInput}
              onChange={(e) => setStepInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddStep()}
              placeholder="Nova subtarefa..."
              className="h-[40px] flex-1 border-b border-slate-200 bg-transparent py-2 text-[13px] font-medium leading-tight text-slate-700 outline-none placeholder:text-slate-300 dark:border-zinc-700 dark:text-zinc-300 dark:placeholder:text-zinc-600"
            />
          </div>
        </div>

        {/* Dates — início: verde se < hoje (permissão); entrega: vermelho se atrasado */}
        {(() => {
          const today = new Date().toISOString().split("T")[0];
          const isStartReady = !!startDate && startDate < today;
          const isDueOverdue = !!dueDate && dueDate < today && task?.status === "PENDENTE";
          return (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
                  <CalendarDays size={11} strokeWidth={1.5} />
                  Inicio
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  onBlur={() => syncMeta({ startDate })}
                  className={`w-full rounded-xl border px-3 py-2.5 text-xs font-semibold outline-none focus:border-indigo-400 dark:border-white/[0.06] ${
                    isStartReady
                      ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/60 dark:bg-emerald-500/10 dark:text-emerald-400"
                      : "border-slate-200/60 bg-slate-50 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
                  <CalendarDays size={11} strokeWidth={1.5} />
                  Entrega
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  onBlur={() => syncMeta({ dueDate })}
                  className={`w-full rounded-xl border px-3 py-2.5 text-xs font-semibold outline-none focus:border-indigo-400 dark:border-white/[0.06] ${
                    isDueOverdue
                      ? "border-red-400 bg-red-50 text-red-700 dark:border-red-500/60 dark:bg-red-500/10 dark:text-red-400"
                      : "border-slate-200/60 bg-slate-50 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                />
              </div>
            </div>
          );
        })()}

        {/* Reminder — estado unificado; persiste ao sair do bloco ou fechar */}
        <div
          className="relative z-10 rounded-xl border border-slate-200/60 bg-slate-50/50 p-4 dark:border-white/[0.04] dark:bg-zinc-800/30"
          onBlur={persistReminder}
        >
          <div className="mb-3 flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-500 dark:text-blue-400">
              <Bell size={11} strokeWidth={1.5} />
              Lembrete
            </label>
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (!task) return;
                await api.updateTask(task.id, { reminder_at: "" });
                setReminder({ date: "", time: "" });
                onRefresh();
              }}
              className="flex items-center gap-1 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-500 dark:hover:bg-zinc-800 dark:hover:text-red-400"
              title="Remover lembrete"
            >
              <Trash2 size={12} strokeWidth={1.5} />
            </button>
          </div>
          {reminderExpiredFeedback && (
            <p className="mb-2 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Lembrete expirado, removido.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={reminder.date}
              onChange={(e) =>
                setReminder((prev) => ({ ...prev, date: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-200/60 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300"
            />
            <Time24Input
              value={reminder.time}
              onChange={(v) =>
                setReminder((prev) => ({ ...prev, time: v }))
              }
              className="w-full rounded-lg border border-slate-200/60 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300"
            />
          </div>
        </div>

        {/* Repeat */}
        <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-4 dark:border-white/[0.04] dark:bg-zinc-800/30">
          <label className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-500 dark:text-orange-400">
            <Repeat size={11} strokeWidth={1.5} />
            Repetir
          </label>
          <select
            value={repeat}
            onChange={(e) => {
              setRepeat(e.target.value);
              syncMeta({ repeat: e.target.value });
            }}
            className="w-full rounded-lg border border-slate-200/60 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300"
          >
            <option value="NONE">Nao repete</option>
            <option value="DAILY">Diariamente</option>
            <option value="WEEKLY">Semanalmente</option>
            <option value="MONTHLY">Mensalmente</option>
            <option value="CUSTOM">A cada X dias</option>
          </select>
          {repeat === "CUSTOM" && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={repeatDays}
                onChange={(e) => setRepeatDays(parseInt(e.target.value) || "")}
                onBlur={() => syncMeta({ repeatDays })}
                className="w-20 rounded-lg border border-slate-200/60 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300"
              />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                dias
              </span>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
            <FileText size={11} strokeWidth={1.5} />
            Anotacoes
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            onBlur={() => syncMeta({ details })}
            placeholder="Notas, links, detalhes..."
            className="h-32 w-full resize-none rounded-xl border border-slate-200/60 bg-slate-50 p-4 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-300 focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300 dark:placeholder:text-zinc-600"
          />
        </div>
      </div>
    </SideSheet>
  );
}
