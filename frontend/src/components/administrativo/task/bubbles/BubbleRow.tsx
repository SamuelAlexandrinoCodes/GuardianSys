/**
 * Barra de filtros/listas/grupos com scroll horizontal.
 * Ver: SortableBubble (chips), useBubbleScroll (scroll), BubbleRowActions (+lista/+grupo).
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../../../../lib/api";
import { type TaskFilterValue, type TaskGroup, removeListFromGroup } from "../helpers/taskHelpers";
import { mainRowOrder } from "./store";
import { groupListSortableId } from "./GroupListButton";
import { GroupBubble } from "./GroupBubble";
import { SortableBubble } from "./SortableBubble";
import { BubbleRowActions } from "./BubbleRowActions";
import { useBubbleScroll, useFilterContextMenuBlock } from "./hooks";
import { getBubbleLabel } from "./utils";
import type { Task } from "../../../../types";

export interface BubbleRowProps {
  bubbleOrder: string[];
  onBubbleOrderChange: (order: string[]) => void;
  onUngroup: (groupId: string) => void;
  taskFilter: TaskFilterValue;
  onTaskFilterChange: (filter: TaskFilterValue) => void;
  lists: { id: number; name: string }[];
  onListsChange: (lists: { id: number; name: string }[]) => void;
  onDeleteListRequest: (listId: number) => void;
  groups: TaskGroup[];
  onGroupsChange: (groups: TaskGroup[]) => void;
  pending: Task[];
  onRefresh: () => void;
  onActiveTaskChange: (task: Task | null) => void;
  hideGhostWhenOverBubbles?: boolean;
}

export function BubbleRow({
  bubbleOrder,
  onBubbleOrderChange,
  onUngroup,
  taskFilter,
  onTaskFilterChange,
  lists,
  onListsChange,
  onDeleteListRequest,
  groups,
  onGroupsChange,
  pending,
  onRefresh,
  onActiveTaskChange,
  hideGhostWhenOverBubbles = false,
}: BubbleRowProps) {
  useFilterContextMenuBlock();

  const [editingListId, setEditingListId] = useState<number | null>(null);
  const [editingListName, setEditingListName] = useState("");
  const [newlyCreatedGroupId, setNewlyCreatedGroupId] = useState<string | null>(null);
  const groupRefsMap = useRef<Record<string, HTMLDivElement | null>>({});

  const { scrollRef, startScroll, stopScroll, handleGrabStart } = useBubbleScroll();
  const { setNodeRef: setZoneRef } = useDroppable({ id: "drop-bubble-zone" });

  const displayOrder = mainRowOrder(bubbleOrder, groups);
  const sortableItems = (() => {
    const out: string[] = [];
    for (const id of displayOrder) {
      if (id.startsWith("group:")) {
        const groupId = id.replace("group:", "");
        out.push(`group-${groupId}`);
        const group = groups.find((g) => g.id === groupId);
        if (group?.listIds?.length) {
          for (const listId of group.listIds) {
            out.push(groupListSortableId(groupId, listId));
          }
        }
      } else {
        out.push(id.startsWith("list:") ? `bubble-${id}` : `bubble-${id}`);
      }
    }
    return out;
  })();

  useEffect(() => {
    if (!newlyCreatedGroupId || !scrollRef.current) return;
    const raf = requestAnimationFrame(() => {
      const el = groupRefsMap.current[newlyCreatedGroupId];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", inline: "end", block: "nearest" });
      } else if (scrollRef.current) {
        scrollRef.current.scrollLeft = scrollRef.current.scrollWidth - scrollRef.current.clientWidth;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [newlyCreatedGroupId, displayOrder]);

  const handleRenameList = useCallback(
    async (listId: number, newName: string) => {
      try {
        await api.updateTaskList(listId, { name: newName });
        onListsChange(lists.map((l) => (l.id === listId ? { ...l, name: newName } : l)));
        onRefresh();
      } catch (e) {
        console.error("Erro ao renomear lista:", e);
      }
    },
    [lists, onListsChange, onRefresh]
  );

  const handleCommitEditList = useCallback(() => {
    if (editingListId === null) return;
    const currentLabel = lists.find((l) => l.id === editingListId)?.name ?? "Lista";
    const name = editingListName.trim() || currentLabel;
    if (name) handleRenameList(editingListId, name);
    setEditingListId(null);
    setEditingListName("");
  }, [editingListId, editingListName, lists, handleRenameList]);

  const handleRemoveListFromGroup = useCallback(
    (groupId: string, listId: number) => {
      onGroupsChange(removeListFromGroup(groups, groupId, listId));
      onBubbleOrderChange([...displayOrder, `list:${listId}`]);
      if (taskFilter === `group:${groupId}`) onTaskFilterChange(`list:${listId}`);
    },
    [groups, displayOrder, taskFilter, onGroupsChange, onBubbleOrderChange, onTaskFilterChange]
  );

  const handleMoveListToGroup = useCallback(
    (listId: number, groupId: string) => {
      const next = groups.map((g) =>
        g.id === groupId && !g.listIds.includes(listId)
          ? { ...g, listIds: [...g.listIds, listId] }
          : g
      );
      onGroupsChange(next);
      onBubbleOrderChange(displayOrder.filter((id) => id !== `list:${listId}`));
      if (taskFilter === `list:${listId}`) onTaskFilterChange(`group:${groupId}`);
    },
    [groups, displayOrder, taskFilter, onGroupsChange, onBubbleOrderChange, onTaskFilterChange]
  );

  return (
    <div ref={setZoneRef} className="flex w-full items-center gap-3 py-0 my-0">
      <div className="relative flex min-w-0 flex-1 items-center">
        <div
          data-no-grab-scroll
          onMouseEnter={() => startScroll("left")}
          onMouseLeave={stopScroll}
          className="absolute left-0 top-0 z-10 flex h-16 w-8 shrink-0 cursor-pointer items-center justify-center rounded-l-md bg-gradient-to-r from-slate-100/90 to-transparent opacity-0 transition-opacity hover:opacity-100 dark:from-zinc-900/90"
          aria-label="Rolar para a esquerda"
        >
          <ChevronLeft size={18} strokeWidth={2} className="text-slate-500 dark:text-zinc-400" />
        </div>
        <div
          ref={scrollRef}
          onMouseDown={handleGrabStart}
          className="flex h-16 min-w-0 flex-1 cursor-grab flex-nowrap items-center gap-2.5 overflow-x-auto overflow-y-visible py-0 my-0 scrollbar-hide active:cursor-grabbing"
        >
          <SortableContext items={sortableItems} strategy={horizontalListSortingStrategy}>
            {displayOrder.map((id) => {
              if (id.startsWith("group:")) {
                const group = groups.find((g) => `group:${g.id}` === id);
                if (!group) return null;
                const tasksInGroup = pending.filter((t) => group.taskIds.includes(t.id));
                return (
                  <div
                    key={id}
                    ref={(el) => { groupRefsMap.current[group.id] = el; }}
                    className="shrink-0"
                  >
                    <GroupBubble
                      group={group}
                      taskFilter={taskFilter}
                      onTaskFilterChange={onTaskFilterChange}
                      lists={lists}
                      tasksInGroup={tasksInGroup}
                      onGroupUpdate={(patch) =>
                        onGroupsChange(groups.map((g) => (g.id === group.id ? { ...g, ...patch } : g)))
                      }
                      onRefresh={onRefresh}
                      onActiveTaskChange={onActiveTaskChange}
                      groups={groups}
                      onGroupsChange={onGroupsChange}
                      onUngroup={onUngroup}
                      onListsChange={onListsChange}
                      onRemoveListFromGroup={handleRemoveListFromGroup}
                      hideGhostWhenOverBubbles={hideGhostWhenOverBubbles}
                      isNewlyCreated={group.id === newlyCreatedGroupId}
                      onEditingComplete={() => setNewlyCreatedGroupId(null)}
                    />
                  </div>
                );
              }
              const label = getBubbleLabel(id, lists, groups);
              const isList = id.startsWith("list:");
              const listId = isList ? parseInt(id.split(":")[1] || "0", 10) : 0;
              return (
                <SortableBubble
                  key={id}
                  id={id}
                  label={label}
                  isActive={taskFilter === id}
                  onClick={() => onTaskFilterChange(id as TaskFilterValue)}
                  onDelete={isList ? () => onDeleteListRequest(listId) : undefined}
                  onRequestRename={isList ? () => { setEditingListId(listId); setEditingListName(label); } : undefined}
                  isEditing={isList && editingListId === listId}
                  editValue={isList && editingListId === listId ? editingListName : undefined}
                  onEditChange={isList ? (v) => setEditingListName(v) : undefined}
                  onEditCommit={isList ? handleCommitEditList : undefined}
                  onEditCancel={isList ? () => { setEditingListId(null); setEditingListName(""); } : undefined}
                  bubbleType={isList ? "list" : "filter"}
                  groups={groups}
                  lists={lists}
                  onMoveToGroup={isList ? (gId) => handleMoveListToGroup(listId, gId) : undefined}
                />
              );
            })}
          </SortableContext>
        </div>
        <div
          data-no-grab-scroll
          onMouseEnter={() => startScroll("right")}
          onMouseLeave={stopScroll}
          className="absolute right-0 top-0 z-10 flex h-16 w-8 shrink-0 cursor-pointer items-center justify-center rounded-r-md bg-gradient-to-l from-slate-100/90 to-transparent opacity-0 transition-opacity hover:opacity-100 dark:from-zinc-900/90"
          aria-label="Rolar para a direita"
        >
          <ChevronRight size={18} strokeWidth={2} className="text-slate-500 dark:text-zinc-400" />
        </div>
      </div>

      <BubbleRowActions
        lists={lists}
        groups={groups}
        displayOrder={displayOrder}
        onListsChange={onListsChange}
        onGroupsChange={onGroupsChange}
        onBubbleOrderChange={onBubbleOrderChange}
        onTaskFilterChange={onTaskFilterChange}
        onNewlyCreatedGroup={(id) => setNewlyCreatedGroupId(id)}
      />
    </div>
  );
}
