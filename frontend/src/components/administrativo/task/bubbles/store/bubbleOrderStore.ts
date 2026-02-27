/**
 * Fonte única de verdade para ordem das bolhas.
 * REGRA: lista em grupo = só no grupo. Lista nas bolhas = só nas bolhas.
 */

import type { TaskGroup } from "../../helpers/taskHelpers";
import {
  BUBBLE_ORDER_KEY,
  DEFAULT_BUBBLES,
  type TaskFilterId,
} from "../../helpers/taskHelpers";

function listIdsInGroups(groups: TaskGroup[]): Set<number> {
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

export function filterListsInGroups(order: string[], groups: TaskGroup[]): string[] {
  const inGroups = listIdsInGroups(groups);
  return order.filter((id) => {
    if (!id.startsWith("list:")) return true;
    const numId = parseInt(id.split(":")[1] || "0", 10);
    return !inGroups.has(numId);
  });
}

export function mainRowOrder(order: string[], groups: TaskGroup[]): string[] {
  return filterListsInGroups(order, groups);
}

export function orderToPersist(order: string[], groups: TaskGroup[]): string[] {
  return filterListsInGroups(order, groups);
}

export function persist(order: string[], apiSave: (data: { bubble_order: string[] }) => Promise<unknown>): void {
  const json = JSON.stringify(order);
  try {
    localStorage.setItem(BUBBLE_ORDER_KEY, json);
  } catch {
    /* ignore */
  }
  apiSave({ bubble_order: order }).catch(() => {});
}

export function loadFromStorage(): string[] {
  try {
    const s = localStorage.getItem(BUBBLE_ORDER_KEY);
    if (s) return JSON.parse(s) as string[];
  } catch {
    /* ignore */
  }
  return [];
}

export function defaultOrder(lists: { id: number }[], groups: TaskGroup[]): string[] {
  const inGroups = listIdsInGroups(groups);
  const listItems = lists
    .filter((l) => !inGroups.has(l.id))
    .map((l) => `list:${l.id}`);
  const groupItems = groups.map((g) => `group:${g.id}`);
  return [
    ...DEFAULT_BUBBLES.map((b) => b.id as TaskFilterId),
    ...listItems,
    ...groupItems,
  ];
}

export function mergeFromApi(
  apiOrder: string[],
  lists: { id: number }[],
  groups: TaskGroup[]
): string[] {
  const defaultIds = DEFAULT_BUBBLES.map((b) => b.id);
  const groupIds = groups.map((g) => `group:${g.id}`);
  const inGroups = listIdsInGroups(groups);
  const valid = apiOrder.filter((id) => {
    if (defaultIds.includes(id as TaskFilterId)) return true;
    if (id.startsWith("group:") && groupIds.includes(id)) return true;
    if (id.startsWith("list:")) {
      const numId = parseInt(id.split(":")[1] || "0", 10);
      if (inGroups.has(numId)) return false;
      return lists.some((l) => l.id === numId);
    }
    return false;
  });
  const missingDefaults = defaultIds.filter((d) => !valid.includes(d));
  const missingLists = lists
    .filter((l) => !inGroups.has(l.id))
    .map((l) => `list:${l.id}`)
    .filter((id) => !valid.includes(id));
  const missingGroups = groupIds.filter((g) => !valid.includes(g));
  return filterListsInGroups(
    [...valid, ...missingDefaults, ...missingLists, ...missingGroups],
    groups
  );
}

export function afterUngroup(order: string[], groupId: string, listIds: number[]): string[] {
  const without = order.filter((id) => id !== `group:${groupId}`);
  const existing = new Set(without);
  const toAdd = listIds
    .map((id) => `list:${id}`)
    .filter((id) => !existing.has(id));
  return [...without, ...toAdd];
}
