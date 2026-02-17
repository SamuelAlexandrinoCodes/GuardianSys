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
} from "lucide-react";
import type { Task, TaskStep } from "../../types";
import { api } from "../../lib/api";
import { SideSheet } from "../ui/SideSheet";

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
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [repeat, setRepeat] = useState("NONE");
  const [repeatDays, setRepeatDays] = useState<number | "">("");
  const [color, setColor] = useState<string | null>(null);
  const [stepInput, setStepInput] = useState("");

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setStartDate(task.start_date || "");
    setDueDate(task.due_date || "");
    setDetails(task.details || task.description || "");
    setRepeat(task.repeat || "NONE");
    setRepeatDays(task.repeat_interval_days || "");
    setColor(task.color);

    if (task.reminder_at) {
      const [d, t] = task.reminder_at.split("T");
      setReminderDate(d || "");
      setReminderTime(t?.slice(0, 5) || "");
    } else {
      setReminderDate("");
      setReminderTime("");
    }
  }, [task]);

  const syncMeta = useCallback(
    async (overrides: Record<string, unknown> = {}) => {
      if (!task) return;
      let reminderAt = "";
      const rd = overrides.reminderDate ?? reminderDate;
      const rt = overrides.reminderTime ?? reminderTime;
      if (rd && rt) {
        reminderAt = `${rd}T${rt}`;
      }
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
      });
      onRefresh();
    },
    [task, title, startDate, dueDate, details, reminderDate, reminderTime, repeat, repeatDays, color, onRefresh]
  );

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

  if (!task) return null;

  return (
    <SideSheet open={!!task} onClose={onClose} title="Detalhes da Tarefa">
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

        {/* Color picker */}
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
                onClick={() => {
                  const newColor = color === c.value ? null : c.value;
                  setColor(newColor);
                  if (onColorChange && task) onColorChange(task.id, newColor);
                  else syncMeta({ color: newColor });
                }}
                className={`h-5 w-5 rounded-full transition-transform hover:scale-125 ${c.bg} ${
                  color === c.value
                    ? "ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-zinc-900 dark:ring-zinc-500"
                    : ""
                }`}
              />
            ))}
            <button
              onClick={() => {
                setColor(null);
                if (onColorChange && task) onColorChange(task.id, null);
                else syncMeta({ color: null });
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
          <div className="flex items-center gap-2">
            <Plus size={14} strokeWidth={1.5} className="shrink-0 text-slate-300 dark:text-zinc-600" />
            <input
              type="text"
              value={stepInput}
              onChange={(e) => setStepInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddStep()}
              placeholder="Adicionar subtarefa..."
              className="flex-1 border-b border-slate-200 bg-transparent py-1.5 text-xs font-medium text-slate-700 outline-none placeholder:text-slate-300 dark:border-zinc-700 dark:text-zinc-300 dark:placeholder:text-zinc-600"
            />
          </div>
        </div>

        {/* Dates */}
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
              className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300"
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
              className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300"
            />
          </div>
        </div>

        {/* Reminder */}
        <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-4 dark:border-white/[0.04] dark:bg-zinc-800/30">
          <label className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-500 dark:text-blue-400">
            <Bell size={11} strokeWidth={1.5} />
            Lembrete
          </label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
              onBlur={() => syncMeta({ reminderDate })}
              className="w-full rounded-lg border border-slate-200/60 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300"
            />
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              onBlur={() => syncMeta({ reminderTime })}
              className="w-full rounded-lg border border-slate-200/60 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300"
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
