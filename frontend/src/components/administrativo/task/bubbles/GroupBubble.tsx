/**
 * Bolha de grupo com listas e tarefas.
 * Ver: GroupListButton (listas sortable), BubbleContextMenu (menu botão direito).
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { Task } from "../../../../types";
import type { TaskGroup, TaskFilterValue } from "../helpers/taskHelpers";
import { TaskRow } from "../TaskRow";
import { api } from "../../../../lib/api";
import { AutoSizeInput } from "../../../ui/AutoSizeInput";
import { BubbleContextMenu } from "./context/BubbleContextMenu";
import { GroupListButton } from "./GroupListButton";
import { useGroupTaskHandlers } from "./hooks";

export interface GroupBubbleProps {
  group: TaskGroup;
  taskFilter: TaskFilterValue;
  onTaskFilterChange: (filter: TaskFilterValue) => void;
  lists: { id: number; name: string }[];
  tasksInGroup: Task[];
  onGroupUpdate: (patch: Partial<Pick<TaskGroup, "name" | "expanded" | "taskIds" | "listIds">>) => void;
  onRefresh: () => void;
  onActiveTaskChange: (task: Task | null) => void;
  groups: TaskGroup[];
  onGroupsChange: (groups: TaskGroup[]) => void;
  onUngroup: (groupId: string) => void;
  onListsChange: (lists: { id: number; name: string }[]) => void;
  onRemoveListFromGroup?: (groupId: string, listId: number) => void;
  hideGhostWhenOverBubbles?: boolean;
  isNewlyCreated?: boolean;
  onEditingComplete?: () => void;
}

export function GroupBubble(props: GroupBubbleProps) {
  const {
    group,
    taskFilter,
    onTaskFilterChange,
    lists,
    tasksInGroup,
    onGroupUpdate,
    onRefresh,
    onActiveTaskChange,
    groups,
    onUngroup,
    onListsChange,
    onRemoveListFromGroup,
    hideGhostWhenOverBubbles = false,
    isNewlyCreated = false,
    onEditingComplete,
  } = props;
  const [editingName, setEditingName] = useState(!!isNewlyCreated);
  const [editValue, setEditValue] = useState(group.name);
  const editInputRef = useRef<HTMLInputElement>(null);
  const bubbleId = `group:${group.id}`;
  const isActive = taskFilter === bubbleId;
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: `group-${group.id}` });
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    isDragging,
  } = useSortable({ id: `group-${group.id}` });
  const setNodeRef = useCallback(
    (el: HTMLDivElement | null) => {
      setDroppableRef(el);
      setSortableRef(el);
    },
    [setDroppableRef, setSortableRef]
  );
  const allTaskHandlers = useGroupTaskHandlers(tasksInGroup, onRefresh);

  const handleToggleExpand = useCallback(() => {
    onGroupUpdate({ expanded: !group.expanded });
  }, [group.expanded, onGroupUpdate]);

  useEffect(() => {
    if (editingName) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingName]);

  const handleRequestRename = useCallback(() => {
    setEditValue(group.name);
    setEditingName(true);
  }, [group.name]);

  const handleCommitRename = useCallback(() => {
    const name = editValue.trim() || group.name;
    if (name) onGroupUpdate({ name });
    setEditingName(false);
    onEditingComplete?.();
  }, [editValue, group.name, onGroupUpdate, onEditingComplete]);

  const handleCancelRename = useCallback(() => {
    setEditValue(group.name);
    setEditingName(false);
    onEditingComplete?.();
  }, [group.name, onEditingComplete]);

  const headerContent = (
    <div
      data-no-grab-scroll
      onClick={(e) => {
        e.stopPropagation();
        if (!editingName) handleToggleExpand();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        handleRequestRename();
      }}
      className={`relative flex h-8 shrink-0 cursor-pointer select-none items-center gap-1.5 whitespace-nowrap rounded-full text-xs font-semibold transition-all duration-200 ${
        editingName ? "px-2 pr-3" : "px-3 pr-4"
      } ${
        isActive
          ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/30 dark:bg-indigo-500"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      }`}
    >
      {group.expanded ? (
        <ChevronDown size={14} strokeWidth={2} className="shrink-0" />
      ) : (
        <ChevronRight size={14} strokeWidth={2} className="shrink-0" />
      )}
      {editingName ? (
        <AutoSizeInput
          ref={editInputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCommitRename();
            if (e.key === "Escape") handleCancelRename();
          }}
          onBlur={() => {
            const name = editValue.trim();
            if (name) handleCommitRename();
            else handleCancelRename();
          }}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 bg-transparent text-xs font-semibold outline-none"
          style={{ maxWidth: "10rem" }}
          data-no-dnd="true"
        />
      ) : (
        <span className="min-w-0 truncate">{group.name}</span>
      )}
    </div>
  );

  return (
    <BubbleContextMenu
      bubbleId={bubbleId}
      bubbleLabel={group.name}
      bubbleType="group"
      groups={groups}
      lists={lists}
      onRename={handleRequestRename}
      onUngroup={() => onUngroup(group.id)}
      onAddListToGroup={async () => {
        const created = await api.createTaskList("Nova Lista");
        onListsChange([...lists, created]);
        onGroupUpdate({ listIds: [...group.listIds, created.id] });
        onRefresh();
      }}
    >
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition: "none",
          opacity: isDragging ? 0.4 : 1,
        }}
        {...attributes}
        {...listeners}
        className={`flex shrink-0 cursor-grab items-stretch gap-0 rounded-xl transition-all active:cursor-grabbing ${
          isOver ? "z-50 bg-blue-500/10 ring-2 ring-blue-400/50 ring-offset-2 dark:bg-blue-500/10 dark:ring-offset-zinc-950" : ""
        } ${isDragging ? "opacity-80 ring-2 ring-indigo-400/50" : ""}`}
      >
        <div
          onClick={() => onTaskFilterChange(bubbleId as TaskFilterValue)}
          className={`flex items-center rounded-xl ${
            group.expanded ? "bg-slate-50/80 dark:bg-zinc-900/80" : ""
          }`}
        >
          {headerContent}
        </div>
        <AnimatePresence>
          {group.expanded && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "auto", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="ml-2 flex w-auto flex-col gap-1.5 overflow-y-auto rounded-xl border border-slate-200/60 bg-slate-50/80 py-2 dark:border-white/[0.06] dark:bg-zinc-900/80">
                {group.listIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 px-2">
                    {group.listIds.map((listId) => {
                        const list = lists.find((l) => l.id === listId);
                        if (!list) return null;
                        const listBubbleId = `list:${listId}`;
                        return (
                          <GroupListButton
                            key={listId}
                            groupId={group.id}
                            listId={listId}
                            listName={list.name}
                            isActive={taskFilter === listBubbleId}
                            onSelect={() => onTaskFilterChange(listBubbleId as TaskFilterValue)}
                            onRemove={onRemoveListFromGroup ? () => onRemoveListFromGroup(group.id, listId) : undefined}
                          />
                        );
                      })}
                    </div>
                )}
                <div className="max-h-[280px] space-y-1 overflow-y-auto px-2">
                  {tasksInGroup.map((task) => (
                    <div key={task.id} className="rounded-lg border-l-2 border-indigo-400/60 pl-2">
                      <TaskRow
                        task={task}
                        isInGroup
                        onToggle={() => allTaskHandlers.onToggle(task)}
                        onDelete={() => allTaskHandlers.onDelete(task.id)}
                        onClick={() => onActiveTaskChange(task)}
                        onTitleChange={allTaskHandlers.onTitleChange}
                        onImportantToggle={() => allTaskHandlers.onImportantToggle(task.id)}
                        onMyDayAdd={() => allTaskHandlers.onMyDayToggle(task.id)}
                        onSetStartDate={(d: string | null) => allTaskHandlers.onSetStartDate(task.id, d)}
                        onMoveToList={(listId: number | null) => allTaskHandlers.onMoveToList(task.id, listId)}
                        onAddStep={allTaskHandlers.onAddStep}
                        onToggleStep={allTaskHandlers.onToggleStep}
                        onDeleteStep={allTaskHandlers.onDeleteStep}
                        onColorChange={(c: string | null) => allTaskHandlers.onColorChange(task.id, c)}
                        lists={lists}
                        hideGhostWhenOverBubbles={hideGhostWhenOverBubbles}
                      />
                    </div>
                  ))}
                  {tasksInGroup.length === 0 && group.listIds.length === 0 && (
                    <p className="py-4 text-center text-[11px] text-slate-400 dark:text-zinc-500">
                      Arraste tarefas ou adicione listas
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </BubbleContextMenu>
  );
}
