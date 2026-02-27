import { pt as chronoPt } from "chrono-node";
import type React from "react";
import { CircleSlash, Repeat, Calendar, CalendarDays, Hash } from "lucide-react";

/* ========================================================================== */
/* Constants                                                                  */
/* ========================================================================== */

export const colorHexMap: Record<string, string> = {
  "border-l-red-500": "#ef4444",
  "border-l-orange-500": "#f97316",
  "border-l-emerald-500": "#10b981",
  "border-l-blue-500": "#3b82f6",
  "border-l-purple-500": "#a855f7",
};

export const colorOptions = [
  { value: "border-l-red-500", bg: "bg-red-500" },
  { value: "border-l-orange-500", bg: "bg-orange-500" },
  { value: "border-l-emerald-500", bg: "bg-emerald-500" },
  { value: "border-l-blue-500", bg: "bg-blue-500" },
  { value: "border-l-purple-500", bg: "bg-purple-500" },
];

/* ========================================================================== */
/* Types                                                                     */
/* ========================================================================== */

export type TaskFilterId = "meu_dia" | "importante" | "planejado" | "geral";
export type TaskFilterValue = TaskFilterId | `list:${number}`;

export interface QuickMeta {
  startDate: string;
  dueDate: string;
  reminderDate: string;
  reminderTime: string;
  repeat: string;
  repeatDays: number | "";
}

export const emptyMeta: QuickMeta = {
  startDate: "",
  dueDate: "",
  reminderDate: "",
  reminderTime: "",
  repeat: "NONE",
  repeatDays: "",
};

/* ========================================================================== */
/* Bubble helpers                                                             */
/* ========================================================================== */

export const BUBBLE_ORDER_KEY = "guardian-task-bubble-order";

export const DEFAULT_BUBBLES: { id: TaskFilterId; label: string }[] = [
  { id: "meu_dia", label: "Meu Dia" },
  { id: "importante", label: "Importante" },
  { id: "planejado", label: "Atribuído a mim" },
  { id: "geral", label: "Geral" },
];

export function loadBubbleOrder(lists: { id: number }[]): string[] {
  try {
    const s = localStorage.getItem(BUBBLE_ORDER_KEY);
    if (s) {
      const parsed = JSON.parse(s) as string[];
      const defaultIds = DEFAULT_BUBBLES.map((b) => b.id);
      const listIds = lists.map((l) => `list:${l.id}`);
      const valid = parsed.filter(
        (id) =>
          defaultIds.includes(id as TaskFilterId) ||
          (id.startsWith("list:") && listIds.includes(id))
      );
      const missingDefaults = defaultIds.filter((d) => !valid.includes(d));
      const missingLists = listIds.filter((l) => !valid.includes(l));
      return [...valid, ...missingDefaults, ...missingLists];
    }
  } catch {
    /* localStorage inválido */
  }
  return [...DEFAULT_BUBBLES.map((b) => b.id), ...lists.map((l) => `list:${l.id}`)];
}

/* ========================================================================== */
/* Smart Reminder Parser (chrono-node + Híbrido)                              */
/* ========================================================================== */

export const pad2 = (n: number) => String(n).padStart(2, "0");

/** Retorna true se o DateTime (date YYYY-MM-DD + time HH:mm) for anterior ou igual a agora. */
export function isReminderInPast(date: string, time: string): boolean {
  if (!date || !time || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{1,2}$/.test(time))
    return false;
  const dt = new Date(`${date}T${time}:00`);
  return !isNaN(dt.getTime()) && dt.getTime() <= Date.now();
}

export function fmtLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function parseSmartInput(raw: string): {
  title: string;
  reminderAt: string | null;
  dueDate: string | null;
} {
  const result = {
    title: raw,
    reminderAt: null as string | null,
    dueDate: null as string | null,
  };

  const reminderRegex = /\s*(?:lembrete|me lembre|lembrar)\s+(.+)$/i;
  const reminderMatch = raw.match(reminderRegex);

  if (reminderMatch) {
    result.title = raw.slice(0, reminderMatch.index).trim();
    const temporalStr = reminderMatch[1]
      .replace(/\bmin\b/gi, "minutos")
      .replace(/\bhr?s?\b/gi, "horas");

    const relativeMatch = temporalStr.match(
      /^(?:em\s+|daqui a\s+)?(\d+)\s*(minuto|minutos|min|m|hora|horas|h|hr)$/i
    );
    if (relativeMatch) {
      const amount = parseInt(relativeMatch[1], 10);
      const unit = relativeMatch[2].toLowerCase();
      const d = new Date();
      if (unit.startsWith("h")) d.setHours(d.getHours() + amount);
      else d.setMinutes(d.getMinutes() + amount);
      result.reminderAt = fmtLocal(d);
    } else {
      const parsed = chronoPt.parseDate(temporalStr, new Date(), { forwardDate: true });
      if (parsed) result.reminderAt = fmtLocal(parsed);
    }
  } else {
    const parsedResults = chronoPt.parse(raw, new Date(), { forwardDate: true });
    if (parsedResults.length > 0) {
      result.dueDate = fmtLocal(parsedResults[0].start.date());
    }
  }

  return result;
}

/* ========================================================================== */
/* Repeat options (for Quick Add popover)                                     */
/* ========================================================================== */

export const repeatOptions: {
  value: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}[] = [
  { value: "NONE", label: "Não repete", icon: CircleSlash },
  { value: "DAILY", label: "Diariamente", icon: Repeat },
  { value: "WEEKLY", label: "Semanalmente", icon: Calendar },
  { value: "MONTHLY", label: "Mensalmente", icon: CalendarDays },
  { value: "CUSTOM", label: "A cada X dias", icon: Hash },
];
