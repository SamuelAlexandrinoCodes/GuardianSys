import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { getEventCoordinates } from "@dnd-kit/utilities";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Sparkles } from "lucide-react";
import type { Task, TaskStep } from "../../types";
import { api } from "../../lib/api";
import { TaskCreator, TaskRow, TaskConfirmModals, TaskCompletedDock, TaskDragOverlay } from "./task";
import {
  BubbleRow,
  mainRowOrder,
  orderToPersist,
  persist,
  mergeFromApi,
  afterUngroup,
  defaultOrder,
  loadFromStorage,
  getBubbleLabel,
  handleBubbleDragEnd,
} from "./task/bubbles";
import { HistoryOverlay } from "./HistoryOverlay";
import {
  loadGroups,
  saveGroups,
  parseGroups,
  addTaskToGroup,
  type TaskFilterValue,
  type TaskGroup,
} from "./task/helpers/taskHelpers";
import { useTaskBoardSensors } from "./task/drag";

const DRAG_OVERLAY_Z_INDEX = 9999999;
const BUBBLE_ZONE_HYSTERESIS_MS = 120;
const PILL_CURSOR_OFFSET = { x: 1, y: -1 };

type ModifierArgs = Parameters<typeof restrictToHorizontalAxis>[0];

/** Posiciona o topo-esquerdo da pílula em cursor atual + offset (cola no cursor) */
function snapPillTopLeftToCursor(args: ModifierArgs) {
  const { activatorEvent, draggingNodeRect, transform } = args;
  if (!draggingNodeRect || !activatorEvent) return transform;
  const initialCoords = getEventCoordinates(activatorEvent);
  if (!initialCoords) return transform;
  const currentX = transform.x + initialCoords.x;
  const currentY = transform.y + initialCoords.y;
  return {
    ...transform,
    x: currentX + PILL_CURSOR_OFFSET.x - draggingNodeRect.left,
    y: currentY + PILL_CURSOR_OFFSET.y - draggingNodeRect.top,
  };
}

export type { TaskFilterId, TaskFilterValue } from "./task/helpers/taskHelpers";

export interface TaskBoardProps {
  pending: Task[];
  completed: Task[];
  taskFilter: TaskFilterValue;
  onTaskFilterChange: (filter: TaskFilterValue) => void;
  lists: { id: number; name: string }[];
  onListsChange: (lists: { id: number; name: string }[]) => void;
  onRefresh: () => void;
  activeTask: Task | null;
  onActiveTaskChange: (task: Task | null) => void;
}

export function TaskBoard({
  pending,
  completed,
  taskFilter,
  onTaskFilterChange,
  lists,
  onListsChange,
  onRefresh,
  activeTask,
  onActiveTaskChange,
}: TaskBoardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [taskUILoaded, setTaskUILoaded] = useState(false);

  const setGroups = useCallback((update: TaskGroup[] | ((prev: TaskGroup[]) => TaskGroup[])) => {
    setGroupsState((prev) => {
      const next = typeof update === "function" ? update(prev) : update;
      saveGroups(next);
      api.saveTaskUI({ task_groups: next }).catch(() => {});
      return next;
    });
  }, []);

  const [groups, setGroupsState] = useState<TaskGroup[]>(loadGroups);
  const [bubbleOrder, setBubbleOrder] = useState<string[]>(() =>
    defaultOrder(lists, loadGroups())
  );
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<number | null>(null);
  const [confirmDeleteList, setConfirmDeleteList] = useState<number | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | number | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const hysteresisTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stabledIsOverBubbleZone, setStabledIsOverBubbleZone] = useState(false);
  const prevTaskFilterRef = useRef(taskFilter);

  const rawIsOverBubbleZone =
    dragOverId?.startsWith("bubble-") ||
    dragOverId?.startsWith("group-") ||
    dragOverId?.startsWith("group-list:") ||
    dragOverId === "drop-bubble-zone";

  useEffect(() => {
    if (rawIsOverBubbleZone) {
      if (hysteresisTimeoutRef.current) {
        clearTimeout(hysteresisTimeoutRef.current);
        hysteresisTimeoutRef.current = null;
      }
      setStabledIsOverBubbleZone(true);
    } else {
      hysteresisTimeoutRef.current = setTimeout(() => {
        setStabledIsOverBubbleZone(false);
        hysteresisTimeoutRef.current = null;
      }, BUBBLE_ZONE_HYSTERESIS_MS);
    }
    return () => {
      if (hysteresisTimeoutRef.current) clearTimeout(hysteresisTimeoutRef.current);
    };
  }, [rawIsOverBubbleZone]);

  useEffect(() => {
    if (!activeDragId) setStabledIsOverBubbleZone(false);
  }, [activeDragId]);

  const dragOverlayModifiers = useMemo(() => {
    const isOverBubbleZone = stabledIsOverBubbleZone;

    return [
      (args: Parameters<typeof restrictToHorizontalAxis>[0]) => {
        const { active } = args;
        const id = active?.id;
        
        if (typeof id === "string" && (id.startsWith("bubble-") || id.startsWith("group-") || id.startsWith("group-list:"))) {
          return restrictToHorizontalAxis(args);
        }

        if (isOverBubbleZone) {
          return snapPillTopLeftToCursor(args);
        }

        return args.transform;
      },
    ];
  }, [stabledIsOverBubbleZone]);

  const sensors = useTaskBoardSensors();

  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    api
      .getTaskUI()
      .then(({ task_groups, bubble_order }) => {
        const fromStorage = loadGroups();
        let parsedGroups = parseGroups(task_groups);
        let apiOrder: string[] = Array.isArray(bubble_order) ? bubble_order : [];

        if (parsedGroups.length === 0 && fromStorage.length > 0) {
          parsedGroups = fromStorage;
          apiOrder = loadFromStorage();
        } else if (fromStorage.length > 0) {
          parsedGroups = parsedGroups.map((g) => {
            const stored = fromStorage.find((s) => s.id === g.id);
            const listIds = (g.listIds?.length ? g.listIds : stored?.listIds) ?? [];
            return { ...g, listIds };
          });
        }

        setGroupsState(parsedGroups);
        const merged = mergeFromApi(apiOrder, lists, parsedGroups);
        setBubbleOrder(merged);
        persist(merged, (d) => api.saveTaskUI({ task_groups: parsedGroups, ...d }));
      })
      .catch(() => {
        const loaded = loadGroups();
        setGroupsState(loaded);
        setBubbleOrder(mergeFromApi(loadFromStorage(), lists, loaded));
      })
      .finally(() => setTaskUILoaded(true));
  }, [lists]);

  useEffect(() => {
    if (!taskUILoaded) return;
    const base = mainRowOrder(bubbleOrder, groups);
    const newIds = lists
      .map((l) => `list:${l.id}`)
      .filter((id) => !base.includes(id));
    const inGroups = new Set(groups.flatMap((g) => g.listIds ?? []));
    const toAdd = newIds.filter((id) => {
      const numId = parseInt(id.split(":")[1] || "0", 10);
      return !inGroups.has(numId);
    });
    if (toAdd.length === 0) return;
    const next = orderToPersist([...base, ...toAdd], groups);
    setBubbleOrder(next);
    persist(next, (d) => api.saveTaskUI(d));
  }, [lists, groups, taskUILoaded, bubbleOrder]);

  const displayOrder = useMemo(
    () => mainRowOrder(bubbleOrder, groups),
    [bubbleOrder, groups]
  );

  const saveBubbleOrder = useCallback((order: string[]) => {
    const safe = orderToPersist(order, groups);
    setBubbleOrder(safe);
    persist(safe, (d) => api.saveTaskUI(d));
  }, [groups]);

  const handleUngroup = useCallback(
    (groupId: string) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group) return;
      const nextGroups = groups.filter((g) => g.id !== groupId);
      const nextOrder = afterUngroup(bubbleOrder, groupId, group.listIds);
      setGroups(nextGroups);
      setBubbleOrder(nextOrder);
      persist(nextOrder, (d) => api.saveTaskUI(d));
      if (taskFilter === `group:${groupId}`) onTaskFilterChange("meu_dia");
    },
    [groups, bubbleOrder, taskFilter, onTaskFilterChange, setGroups]
  );

  useEffect(() => {
    if (!activeTask) return;
    const filterJustChanged = prevTaskFilterRef.current !== taskFilter;
    prevTaskFilterRef.current = taskFilter;
    if (filterJustChanged) return;

    const id = activeTask.id;
    const updated = [...pending, ...completed].find((t) => t.id === id);
    if (updated) onActiveTaskChange(updated);
  }, [pending, completed, activeTask, taskFilter, onActiveTaskChange]);

  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  const handleTaskDropOnBubble = useCallback(
    async (taskId: number, bubbleId: string) => {
      if (bubbleId.startsWith("group:")) {
        const groupId = bubbleId.replace("group:", "");
        setGroups((prev) => addTaskToGroup(prev, groupId, taskId));
        return;
      }
      const todayStr = new Date().toISOString().split("T")[0];
      const payload: Record<string, unknown> = {};
      if (bubbleId === "meu_dia") payload.start_date = todayStr;
      else if (bubbleId === "importante") payload.is_important = true;
      else if (bubbleId.startsWith("list:")) payload.list_id = parseInt(bubbleId.split(":")[1] || "0", 10) || null;
      else if (bubbleId === "planejado") payload.is_assigned = true;
      
      if (Object.keys(payload).length > 0) {
        await api.updateTask(taskId, payload);
        onRefresh();
      }
    },
    [onRefresh, setGroups]
  );

  const handleDragStart = useCallback((event: { active: { id: unknown } }) => {
    const id = event.active.id;
    setActiveDragId(id === null || id === undefined ? null : id as string | number);
  }, []);

  const handleDragOver = useCallback((event: { over: { id: unknown } | null }) => {
    setDragOverId(event.over ? String(event.over.id) : null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDragId(null);
      setDragOverId(null);
      const handled = await handleBubbleDragEnd(event, {
        displayOrder,
        groups,
        taskFilter,
        setGroups,
        saveBubbleOrder,
        onTaskFilterChange,
        handleTaskDropOnBubble,
      });
      if (handled) return;

      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIdx = pending.findIndex((t) => t.id === active.id);
      const newIdx = pending.findIndex((t) => t.id === over.id);
      if (oldIdx !== -1 && newIdx !== -1) {
        const reordered = arrayMove(pending, oldIdx, newIdx);
        try {
          await api.reorderTasks(reordered.map((t) => t.id));
          onRefresh();
        } catch (e) {
          console.error("Erro ao reordenar:", e);
        }
      }
    },
    [pending, displayOrder, groups, saveBubbleOrder, handleTaskDropOnBubble, onRefresh, taskFilter, onTaskFilterChange, setGroups]
  );

  const handleToggle = useCallback(async (task: Task) => {
    await api.toggleTask(task.id);
    onRefresh();
  }, [onRefresh]);

  const handleDelete = useCallback((taskId: number) => setConfirmDeleteTask(taskId), []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!confirmDeleteTask) return;
    await api.deleteTask(confirmDeleteTask);
    if (activeTask?.id === confirmDeleteTask) onActiveTaskChange(null);
    setConfirmDeleteTask(null);
    onRefresh();
  }, [confirmDeleteTask, activeTask, onRefresh, onActiveTaskChange]);

  const handleAddStep = useCallback(async (task: Task, title: string) => {
    await api.addStep(task.id, title);
    onRefresh();
  }, [onRefresh]);

  const handleToggleStep = useCallback(async (task: Task, step: TaskStep) => {
    await api.toggleStep(task.id, step.id);
    onRefresh();
  }, [onRefresh]);

  const handleDeleteStep = useCallback(async (task: Task, stepId: number) => {
    await api.deleteStep(task.id, stepId);
    onRefresh();
  }, [onRefresh]);

  const handleColorChange = useCallback(async (taskId: number, color: string | null) => {
    await api.updateTask(taskId, { color: color ?? "" });
    onRefresh();
  }, [onRefresh]);

  const handleImportantToggle = useCallback(async (taskId: number) => {
    const t = [...pending, ...completed].find((x) => x.id === taskId);
    if (!t) return;
    await api.updateTask(taskId, { is_important: !(t.is_important ?? false) });
    onRefresh();
  }, [pending, completed, onRefresh]);

  const handleMyDayToggle = useCallback(async (taskId: number) => {
    const t = [...pending, ...completed].find((x) => x.id === taskId);
    if (!t) return;
    const todayStr = new Date().toISOString().split("T")[0];
    const isInMyDay = t.start_date && t.start_date <= todayStr;
    await api.updateTask(taskId, { start_date: isInMyDay ? "" : todayStr });
    onRefresh();
  }, [pending, completed, onRefresh]);

  const handleSetStartDate = useCallback(async (taskId: number, dateStr: string | null) => {
    await api.updateTask(taskId, { start_date: dateStr });
    onRefresh();
  }, [onRefresh]);

  const handleMoveToList = useCallback(async (taskId: number, listId: number | null) => {
    await api.updateTask(taskId, { list_id: listId });
    onRefresh();
  }, [onRefresh]);

  const handleDeleteListRequest = useCallback((listId: number) => setConfirmDeleteList(listId), []);

  const handleDeleteListConfirm = useCallback(async () => {
    if (!confirmDeleteList) return;
    try {
      await api.deleteTaskList(confirmDeleteList);
      onListsChange(lists.filter((l) => l.id !== confirmDeleteList));
      saveBubbleOrder(displayOrder.filter((id) => id !== `list:${confirmDeleteList}`));
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          listIds: g.listIds.filter((id) => id !== confirmDeleteList),
        }))
      );
      if (taskFilter === `list:${confirmDeleteList}`) onTaskFilterChange("meu_dia");
      onRefresh();
    } catch (e) {
      console.error("Erro ao excluir lista:", e);
    } finally {
      setConfirmDeleteList(null);
    }
  }, [confirmDeleteList, lists, displayOrder, taskFilter, onListsChange, saveBubbleOrder, onTaskFilterChange, onRefresh, setGroups]);

  const taskIdsInGroups = useMemo(
    () => new Set(groups.flatMap((g) => g.taskIds)),
    [groups]
  );
  const pendingUngrouped = pending.filter((t) => !taskIdsInGroups.has(t.id));

  const todayCompleted = completed
    .filter((t) => t.completed_at && t.completed_at.startsWith(todayStr))
    .sort((a, b) => (b.completed_at || "").localeCompare(a.completed_at || ""));

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex h-full flex-col">
          <div className="shrink-0 px-6 pt-6 pb-4">
            <TaskCreator
              taskFilter={taskFilter}
              onRefresh={onRefresh}
              onTaskCreated={(taskId) => {
                if (taskFilter.startsWith("group:")) {
                  const groupId = taskFilter.replace("group:", "");
                  setGroups((prev) => addTaskToGroup(prev, groupId, taskId));
                }
              }}
            />
            <BubbleRow
              bubbleOrder={displayOrder}
              onBubbleOrderChange={saveBubbleOrder}
              onUngroup={handleUngroup}
              taskFilter={taskFilter}
              onTaskFilterChange={onTaskFilterChange}
              lists={lists}
              onListsChange={onListsChange}
              onDeleteListRequest={handleDeleteListRequest}
              groups={groups}
              onGroupsChange={setGroups}
              pending={pending}
              onRefresh={onRefresh}
              onActiveTaskChange={onActiveTaskChange}
              hideGhostWhenOverBubbles={
                !!activeDragId &&
                typeof activeDragId !== "string" &&
                !String(activeDragId).startsWith("bubble-") &&
                stabledIsOverBubbleZone
              }
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none px-6 pb-2">
            <SortableContext items={pendingUngrouped.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {pendingUngrouped.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  lists={lists}
                  hideGhostWhenOverBubbles={
                    !!activeDragId &&
                    typeof activeDragId !== "string" &&
                    !String(activeDragId).startsWith("bubble-") &&
                    stabledIsOverBubbleZone
                  }
                  onToggle={() => handleToggle(task)}
                  onDelete={() => handleDelete(task.id)}
                  onClick={() => onActiveTaskChange(task)}
                  onTitleChange={async (t, newTitle) => {
                    await api.updateTask(t.id, { title: newTitle });
                    onRefresh();
                  }}
                  onImportantToggle={() => handleImportantToggle(task.id)}
                  onMyDayAdd={() => handleMyDayToggle(task.id)}
                  onSetStartDate={(date) => handleSetStartDate(task.id, date)}
                  onMoveToList={(listId) => handleMoveToList(task.id, listId)}
                  onAddStep={handleAddStep}
                  onToggleStep={handleToggleStep}
                  onDeleteStep={handleDeleteStep}
                  onColorChange={(color) => handleColorChange(task.id, color)}
                />
              ))}
            </SortableContext>

            {pendingUngrouped.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20">
                <Sparkles size={40} strokeWidth={1} className="mb-4 text-slate-200 dark:text-zinc-700" />
                <p className="text-sm font-bold tracking-tight text-slate-300 dark:text-zinc-600">
                  Comando limpo.
                </p>
              </div>
            )}
          </div>

          <TaskCompletedDock
            todayCompleted={todayCompleted}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onShowHistory={() => setShowHistory(true)}
          />
        </div>

        {activeDragId && typeof document !== "undefined"
          ? createPortal(
              <DragOverlay
                zIndex={DRAG_OVERLAY_Z_INDEX}
                modifiers={dragOverlayModifiers}
                style={{
                  pointerEvents: "none",
                  position: "fixed",
                  zIndex: DRAG_OVERLAY_Z_INDEX,
                }}
              >
                <div style={{ position: "relative", zIndex: 1, isolation: "isolate" }}>
                {(() => {
                  const activeStr = typeof activeDragId === "string" ? activeDragId : "";
                  const isDraggingBubble = activeStr.startsWith("bubble-");
                  const isDraggingGroup = activeStr.startsWith("group-") && !activeStr.startsWith("group-list:");
                  const isDraggingGroupList = activeStr.startsWith("group-list:");
                  const isOverBubbleZone = stabledIsOverBubbleZone;

                  if (isDraggingBubble || isDraggingGroup || isDraggingGroupList) {
                    let label: string;
                    if (isDraggingGroupList) {
                      const rest = activeStr.slice("group-list:".length);
                      const lastColon = rest.lastIndexOf(":");
                      const listId = parseInt(rest.slice(lastColon + 1), 10);
                      const list = lists.find((l) => l.id === listId);
                      label = list?.name ?? "Lista";
                    } else if (isDraggingGroup) {
                      const groupId = activeStr.replace("group-", "");
                      const group = groups.find((g) => g.id === groupId);
                      label = group?.name ?? "Grupo";
                    } else {
                      const bubbleId = activeStr.replace("bubble-", "");
                      label = getBubbleLabel(bubbleId, lists, groups);
                    }
                    return (
                      <div
                        className="flex h-8 shrink-0 cursor-grabbing select-none items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-xs font-semibold shadow-lg ring-2 ring-indigo-400/50 transition-shadow duration-150"
                        style={{
                          backgroundColor: "rgb(99 102 241)",
                          color: "white",
                          boxShadow: "0 10px 40px -10px rgba(99, 102, 241, 0.5)",
                        }}
                      >
                        <span className="min-w-0 truncate">{label}</span>
                      </div>
                    );
                  }

                  const task = pending.find((t) => t.id === activeDragId) || completed.find((t) => t.id === activeDragId);
                  return task ? <TaskDragOverlay task={task} isOverBubbleZone={isOverBubbleZone} /> : null;
                })()}
                </div>
              </DragOverlay>,
              document.body
            )
          : null}
      </DndContext>

      <TaskConfirmModals
        confirmDeleteTask={confirmDeleteTask}
        confirmDeleteList={confirmDeleteList}
        onCancelTask={() => setConfirmDeleteTask(null)}
        onConfirmTask={handleDeleteConfirm}
        onCancelList={() => setConfirmDeleteList(null)}
        onConfirmList={handleDeleteListConfirm}
      />

      <HistoryOverlay
        open={showHistory}
        onClose={() => setShowHistory(false)}
        completed={completed}
        onToggle={handleToggle}
        onDelete={handleDelete}
      />
    </>
  );
}