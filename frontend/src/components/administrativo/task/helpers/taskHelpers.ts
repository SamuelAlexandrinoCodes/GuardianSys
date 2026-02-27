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
export type TaskFilterValue = TaskFilterId | `list:${number}` | `group:${string}`;

export interface TaskGroup {
  id: string;
  name: string;
  expanded: boolean;
  taskIds: number[];
  listIds: number[];
}

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
export const TASK_GROUPS_KEY = "guardian-task-groups";

export const DEFAULT_BUBBLES: { id: TaskFilterId; label: string }[] = [
  { id: "meu_dia", label: "Meu Dia" },
  { id: "importante", label: "Importante" },
  { id: "planejado", label: "Atribuído a mim" },
  { id: "geral", label: "Geral" },
];

export function mergeBubbleOrder(
  savedOrder: string[],
  lists: { id: number }[],
  groups: TaskGroup[] = []
): string[] {
  const defaultIds = DEFAULT_BUBBLES.map((b) => b.id);
  const listIds = lists.map((l) => `list:${l.id}`);
  const groupIds = groups.map((g) => `group:${g.id}`);
  const listIdsInGroups = getListIdsInGroups(groups);

  const valid = savedOrder.filter((id) => {
    if (defaultIds.includes(id as TaskFilterId)) return true;
    if (id.startsWith("group:") && groupIds.includes(id)) return true;
    if (id.startsWith("list:")) {
      const numId = parseInt(id.split(":")[1] || "0", 10);
      if (listIdsInGroups.has(numId)) return false;
      return listIds.includes(id);
    }
    return false;
  });

  const missingDefaults = defaultIds.filter((d) => !valid.includes(d));
  const missingLists = listIds.filter(
    (l) => !listIdsInGroups.has(parseInt(l.split(":")[1] || "0", 10)) && !valid.includes(l)
  );
  const missingGroups = groupIds.filter((g) => !valid.includes(g));
  return [...valid, ...missingDefaults, ...missingLists, ...missingGroups];
}

/** IDs de listas que pertencem a algum grupo. Lista em grupo = só aparece no grupo, nunca na linha principal. */
export function getListIdsInGroups(groups: TaskGroup[]): Set<number> {
  const ids = new Set<number>();
  for (const g of groups) {
    const arr = (g as unknown as Record<string, unknown>).listIds ?? (g as unknown as Record<string, unknown>).list_ids;
    if (Array.isArray(arr)) {
      for (const x of arr) {
        const n = typeof x === "number" ? x : parseInt(String(x), 10);
        if (!isNaN(n)) ids.add(n);
      }
    }
  }
  return ids;
}

/**
 * Ordem das bolhas na linha principal.
 * REGRA: list:X só aparece se X NÃO está em nenhum group.listIds.
 * Lista em grupo = só no grupo. Lista nas bolhas = só nas bolhas.
 */
export function computeMainRowOrder(order: string[], groups: TaskGroup[]): string[] {
  const inGroups = getListIdsInGroups(groups);
  return order.filter((id) => {
    if (!id.startsWith("list:")) return true;
    const numId = parseInt(id.split(":")[1] || "0", 10);
    return !inGroups.has(numId);
  });
}

/** Remove list:X quando X está em grupo. Para PERSISTIR: order nunca deve ter list em grupo. */
export function sanitizeBubbleOrder(order: string[], groups: TaskGroup[]): string[] {
  return computeMainRowOrder(order, groups);
}

/** Ao desagrupar: remove group e adiciona listas ao final, sem duplicar. */
export function orderAfterUngroup(
  order: string[],
  groupId: string,
  listIdsToAdd: number[]
): string[] {
  const withoutGroup = order.filter((id) => id !== `group:${groupId}`);
  const existing = new Set(withoutGroup);
  const toAdd = listIdsToAdd
    .map((id) => `list:${id}`)
    .filter((id) => !existing.has(id));
  return [...withoutGroup, ...toAdd];
}

export function loadBubbleOrder(
  lists: { id: number }[],
  groups: TaskGroup[] = [],
  savedOrder?: string[] | null
): string[] {
  if (savedOrder && Array.isArray(savedOrder) && savedOrder.length > 0) {
    return mergeBubbleOrder(savedOrder, lists, groups);
  }
  try {
    const s = localStorage.getItem(BUBBLE_ORDER_KEY);
    if (s) {
      const parsed = JSON.parse(s) as string[];
      return mergeBubbleOrder(parsed, lists, groups);
    }
  } catch {
    /* localStorage inválido */
  }
  const listIdsInGroups = getListIdsInGroups(groups);
  return [
    ...DEFAULT_BUBBLES.map((b) => b.id),
    ...lists.filter((l) => !listIdsInGroups.has(l.id)).map((l) => `list:${l.id}`),
    ...groups.map((g) => `group:${g.id}`),
  ];
}

/* ========================================================================== */
/* Task Group helpers                                                         */
/* ========================================================================== */

function toNumList(arr: unknown): number[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => (typeof x === "number" ? x : parseInt(String(x), 10))).filter((n) => !isNaN(n));
}

export function parseGroups(raw: unknown): TaskGroup[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((g) => g && typeof g.id === "string" && typeof g.name === "string")
    .map((g) => {
      const obj = g as Record<string, unknown>;
      return {
        id: String(obj.id),
        name: String(obj.name),
        expanded: Boolean(obj.expanded),
        taskIds: toNumList(obj.taskIds ?? obj.task_ids),
        listIds: toNumList(obj.listIds ?? obj.list_ids),
      };
    });
}

export function loadGroups(): TaskGroup[] {
  try {
    const s = localStorage.getItem(TASK_GROUPS_KEY);
    if (s) {
      const parsed = JSON.parse(s);
      return parseGroups(parsed);
    }
  } catch {
    /* localStorage inválido */
  }
  return [];
}

export function saveGroups(groups: TaskGroup[]): void {
  localStorage.setItem(TASK_GROUPS_KEY, JSON.stringify(groups));
}

function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function addGroup(name = "Novo Grupo"): TaskGroup {
  return {
    id: uuidv4(),
    name,
    expanded: false,
    taskIds: [],
    listIds: [],
  };
}

export function updateGroup(
  groups: TaskGroup[],
  id: string,
  patch: Partial<Pick<TaskGroup, "name" | "expanded" | "taskIds" | "listIds">>
): TaskGroup[] {
  return groups.map((g) => (g.id === id ? { ...g, ...patch } : g));
}

export function removeGroup(groups: TaskGroup[], id: string): TaskGroup[] {
  return groups.filter((g) => g.id !== id);
}

export function addTaskToGroup(groups: TaskGroup[], groupId: string, taskId: number): TaskGroup[] {
  return groups.map((g) => {
    if (g.id !== groupId || g.taskIds.includes(taskId)) return g;
    return { ...g, taskIds: [...g.taskIds, taskId] };
  });
}

export function removeTaskFromGroup(
  groups: TaskGroup[],
  groupId: string,
  taskId: number
): TaskGroup[] {
  return groups.map((g) => {
    if (g.id !== groupId) return g;
    return { ...g, taskIds: g.taskIds.filter((id) => id !== taskId) };
  });
}

export function addListToGroup(
  groups: TaskGroup[],
  groupId: string,
  listId: number
): TaskGroup[] {
  return groups.map((g) => {
    if (g.id !== groupId || g.listIds.includes(listId)) return g;
    return { ...g, listIds: [...g.listIds, listId] };
  });
}

export function removeListFromGroup(
  groups: TaskGroup[],
  groupId: string,
  listId: number
): TaskGroup[] {
  return groups.map((g) => {
    if (g.id !== groupId) return g;
    return { ...g, listIds: g.listIds.filter((id) => id !== listId) };
  });
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
