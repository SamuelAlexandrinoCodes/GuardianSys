/**
 * Helpers para bubbles (filtros, listas, grupos).
 */

import type { TaskGroup } from "../../helpers/taskHelpers";
import { DEFAULT_BUBBLES } from "../../helpers/taskHelpers";

export function getBubbleLabel(
  id: string,
  lists: { id: number; name: string }[],
  groups: TaskGroup[] = []
): string {
  if (id.startsWith("list:")) {
    const listId = parseInt(id.split(":")[1] || "0", 10);
    return lists.find((l) => l.id === listId)?.name ?? "Lista";
  }
  if (id.startsWith("group:")) {
    const gId = id.replace("group:", "");
    return groups.find((g) => g.id === gId)?.name ?? "Grupo";
  }
  return DEFAULT_BUBBLES.find((b) => b.id === id)?.label ?? id;
}
