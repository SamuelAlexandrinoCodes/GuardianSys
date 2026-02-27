/**
 * Lógica de drag-and-drop das bolhas (filtros, listas, grupos).
 * Usa a mesma lógica do sortable: soltar em bubble = bubbles dão espaço (insert na posição).
 */

import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import {
  addListToGroup,
  removeListFromGroup,
  type TaskFilterValue,
  type TaskGroup,
} from "../../helpers/taskHelpers";

const DROP_BUBBLE_ZONE = "drop-bubble-zone";

export interface BubbleDragContext {
  displayOrder: string[];
  groups: TaskGroup[];
  taskFilter: TaskFilterValue;
  setGroups: (update: TaskGroup[] | ((prev: TaskGroup[]) => TaskGroup[])) => void;
  saveBubbleOrder: (order: string[]) => void;
  onTaskFilterChange: (filter: TaskFilterValue) => void;
  handleTaskDropOnBubble: (taskId: number, bubbleId: string) => Promise<void>;
}

const toSortableId = (displayId: string) =>
  displayId.startsWith("group:")
    ? `group-${displayId.replace("group:", "")}`
    : `bubble-${displayId}`;

/**
 * Retorna true se o evento foi tratado (drop de bubble/group); false para deixar o TaskBoard tratar (ex: reordenar tasks).
 */
export async function handleBubbleDragEnd(
  event: DragEndEvent,
  ctx: BubbleDragContext
): Promise<boolean> {
  const { active, over } = event;
  if (!over || active.id === over.id) return false;

  const overStr = String(over.id);
  const activeStr = String(active.id);
  const {
    displayOrder,
    groups,
    taskFilter,
    setGroups,
    saveBubbleOrder,
    onTaskFilterChange,
    handleTaskDropOnBubble,
  } = ctx;

  // Task dropped on bubble/group
  if (
    (overStr.startsWith("bubble-") || overStr.startsWith("group-")) &&
    !activeStr.startsWith("bubble-") &&
    !activeStr.startsWith("group-")
  ) {
    const bubbleId = overStr.startsWith("group-")
      ? overStr.replace("group-", "group:")
      : overStr.replace("bubble-", "");
    const taskId = typeof active.id === "number" ? active.id : parseInt(activeStr, 10);
    if (!isNaN(taskId) && bubbleId) {
      await handleTaskDropOnBubble(taskId, bubbleId);
    }
    return true;
  }

  // Lista da barra principal → soltar em grupo (adicionar a grupo existente)
  if (activeStr.startsWith("bubble-") && overStr.startsWith("group-")) {
    const bubbleId = activeStr.replace("bubble-", "");
    if (bubbleId.startsWith("list:")) {
      const listId = parseInt(bubbleId.split(":")[1] || "0", 10);
      const groupId = overStr.replace("group-", "");
      if (listId && groupId) {
        setGroups((prev) => addListToGroup(prev, groupId, listId));
        saveBubbleOrder(displayOrder.filter((id) => id !== `list:${listId}`));
        if (taskFilter === `list:${listId}`) onTaskFilterChange(`group:${groupId}`);
      }
    }
    return true;
  }

  // group-list:G:A (lista dentro de grupo)
  const groupListPrefix = "group-list:";
  if (activeStr.startsWith(groupListPrefix)) {
    const rest = activeStr.slice(groupListPrefix.length);
    const lastColon = rest.lastIndexOf(":");
    if (lastColon === -1) return false;
    const activeGroupId = rest.slice(0, lastColon);
    const activeListId = parseInt(rest.slice(lastColon + 1), 10);
    if (isNaN(activeListId)) return false;

    const getTargetGroupId = (str: string): string | null => {
      if (str.startsWith("group-list:")) {
        const r = str.slice("group-list:".length);
        const c = r.lastIndexOf(":");
        return c === -1 ? null : r.slice(0, c);
      }
      if (str.startsWith("group-")) return str.replace("group-", "");
      return null;
    };
    const targetGroupId = getTargetGroupId(overStr);

    // Mover lista para outro grupo
    if (targetGroupId && targetGroupId !== activeGroupId) {
      setGroups((prev) =>
        addListToGroup(
          removeListFromGroup(prev, activeGroupId, activeListId),
          targetGroupId,
          activeListId
        )
      );
      if (taskFilter === `group:${activeGroupId}`) onTaskFilterChange(`list:${activeListId}`);
      return true;
    }

    // Sair do grupo → barra principal (só se soltar em bubble-X específica; drop-bubble-zone = não fazer nada)
    if (overStr.startsWith("bubble-")) {
      const toSortableIdForInsert = (displayId: string) =>
        displayId.startsWith("group:")
          ? `group-${displayId.replace("group:", "")}`
          : `bubble-${displayId}`;

      const insertIdx = displayOrder.findIndex((id) => toSortableIdForInsert(id) === overStr);
      if (insertIdx !== -1) {
        setGroups((prev) => removeListFromGroup(prev, activeGroupId, activeListId));
        const newOrder = [
          ...displayOrder.slice(0, insertIdx),
          `list:${activeListId}`,
          ...displayOrder.slice(insertIdx),
        ];
        saveBubbleOrder(newOrder);
        if (taskFilter === `group:${activeGroupId}`) onTaskFilterChange(`list:${activeListId}`);
      }
      return true;
    }
    if (overStr === DROP_BUBBLE_ZONE) return true; // nowhere = não alterar

    // Reordenar dentro do mesmo grupo
    if (overStr.startsWith("group-list:") && targetGroupId === activeGroupId) {
      const overRest = overStr.slice("group-list:".length);
      const overLastColon = overRest.lastIndexOf(":");
      if (overLastColon !== -1) {
        const group = groups.find((g) => g.id === activeGroupId);
        if (group) {
          const overListId = parseInt(overRest.slice(overLastColon + 1), 10);
          const oldIdx = group.listIds.indexOf(activeListId);
          const newIdx = group.listIds.indexOf(overListId);
          if (oldIdx !== -1 && newIdx !== -1) {
            const reordered = arrayMove(group.listIds, oldIdx, newIdx);
            setGroups((prev) =>
              prev.map((g) => (g.id === activeGroupId ? { ...g, listIds: reordered } : g))
            );
          }
        }
      }
      return true;
    }
  }

  // Reordenar bubble/group na barra principal
  const resolveOverToMainRowId = (str: string): string | null => {
    if (str.startsWith("group-list:")) {
      const rest = str.slice("group-list:".length);
      const lastColon = rest.lastIndexOf(":");
      if (lastColon === -1) return null;
      return `group-${rest.slice(0, lastColon)}`;
    }
    if (str.startsWith("group-") || str.startsWith("bubble-")) return str;
    return null;
  };

  if (
    activeStr.startsWith("bubble-") ||
    (activeStr.startsWith("group-") && !activeStr.startsWith("group-list:"))
  ) {
    const overResolved = resolveOverToMainRowId(overStr);
    // Só reordena se soltou em cima de bubble/group específica; drop-bubble-zone (nowhere) = não alterar
    if (overResolved) {
      const oldIdx = displayOrder.findIndex((id) => toSortableId(id) === activeStr);
      const newIdx = displayOrder.findIndex((id) => toSortableId(id) === overResolved);
      if (oldIdx !== -1 && newIdx !== -1) {
        saveBubbleOrder(arrayMove(displayOrder, oldIdx, newIdx));
      }
    }
    return true;
  }

  return false;
}
