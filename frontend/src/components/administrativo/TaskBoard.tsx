import { useState, useCallback, useEffect, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Sparkles } from "lucide-react";
import type { Task, TaskStep } from "../../types";
import { api } from "../../lib/api";
import { TaskCreator, TaskRow, TaskSideSheet, TaskConfirmModals, TaskCompletedDock, TaskDragOverlay } from "./task";
import { BubbleRow } from "./bubbles/BubbleRow";
import { HistoryOverlay } from "./HistoryOverlay";
import {
  loadBubbleOrder,
  BUBBLE_ORDER_KEY,
  DEFAULT_BUBBLES,
  type TaskFilterValue,
} from "./task/taskHelpers";

/* ========================================================================== */
/* Props                                                                      */
/* ========================================================================== */

export type { TaskFilterId, TaskFilterValue } from "./task/taskHelpers";

export interface TaskBoardProps {
  pending: Task[];
  completed: Task[];
  taskFilter: TaskFilterValue;
  onTaskFilterChange: (filter: TaskFilterValue) => void;
  lists: { id: number; name: string }[];
  onListsChange: (lists: { id: number; name: string }[]) => void;
  onRefresh: () => void;
}

/* ========================================================================== */
/* TaskBoard                                                                  */
/* ========================================================================== */

export function TaskBoard({
  pending,
  completed,
  taskFilter,
  onTaskFilterChange,
  lists,
  onListsChange,
  onRefresh,
}: TaskBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [bubbleOrder, setBubbleOrder] = useState<string[]>(() =>
    loadBubbleOrder(lists)
  );
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<number | null>(null);
  const [confirmDeleteList, setConfirmDeleteList] = useState<number | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | number | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Modificador Mágico: Desvincula a pílula do eixo original e cola na ponta do mouse
  const dragOverlayModifiers = useMemo(() => {
    const isOverBubbleZone = dragOverId?.startsWith("bubble-") || dragOverId === "drop-bubble-zone";

    return [
      (args: Parameters<typeof restrictToHorizontalAxis>[0]) => {
        const { active, activatorEvent, activeNodeRect, transform } = args;
        const id = active?.id;
        
        if (typeof id === "string" && id.startsWith("bubble-")) {
          return restrictToHorizontalAxis(args);
        }

        if (isOverBubbleZone && activatorEvent && activeNodeRect) {
          let currentX = 0;
          let currentY = 0;
          
          const ev = activatorEvent as MouseEvent | TouchEvent;
          if ('touches' in ev && ev.touches.length > 0) {
            currentX = ev.touches[0].clientX + transform.x;
            currentY = ev.touches[0].clientY + transform.y;
          } else if ('clientX' in ev) {
            currentX = (ev as MouseEvent).clientX + transform.x;
            currentY = (ev as MouseEvent).clientY + transform.y;
          } else {
            return transform;
          }

          return {
            ...transform,
            x: currentX - activeNodeRect.left + 15, // Pendura 15px a direita do mouse
            y: currentY - activeNodeRect.top - 15,  // Pendura 15px acima do mouse
          };
        }

        // Se não estiver sobre as bolhas, mantém ancoragem realista do clique
        return transform;
      },
    ];
  }, [dragOverId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    setBubbleOrder((prev) => {
      const listIds = lists.map((l) => `list:${l.id}`);
      const newListIds = listIds.filter((id) => !prev.includes(id));
      if (newListIds.length === 0) return prev;
      const next = [...prev, ...newListIds];
      localStorage.setItem(BUBBLE_ORDER_KEY, JSON.stringify(next));
      return next;
    });
  }, [lists]);

  const saveBubbleOrder = useCallback((order: string[]) => {
    setBubbleOrder(order);
    localStorage.setItem(BUBBLE_ORDER_KEY, JSON.stringify(order));
  }, []);

  useEffect(() => {
    if (!activeTask) return;
    const id = activeTask.id;
    const updated = [...pending, ...completed].find((t) => t.id === id);
    if (updated) setActiveTask(updated);
  }, [pending, completed, activeTask]);

  useEffect(() => {
    const win = window as unknown as { __pendingReminderTask?: Task };
    const pendingTask = win.__pendingReminderTask;
    if (pendingTask) {
      delete win.__pendingReminderTask;
      setActiveTask(pendingTask);
    }
    const handler = (e: CustomEvent<Task>) => setActiveTask(e.detail);
    window.addEventListener("reminder-open-task", handler as EventListener);
    return () =>
      window.removeEventListener("reminder-open-task", handler as EventListener);
  }, []);

  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  useEffect(() => {
    window.addEventListener("focus", onRefresh);
    return () => window.removeEventListener("focus", onRefresh);
  }, [onRefresh]);

  useEffect(() => {
    const handler = () => onRefresh();
    window.addEventListener("reminder-updated", handler);
    return () => window.removeEventListener("reminder-updated", handler);
  }, [onRefresh]);

  useEffect(() => {
    const handler = () => onRefresh();
    window.addEventListener("reminder-triggered", handler);
    return () => window.removeEventListener("reminder-triggered", handler);
  }, [onRefresh]);

  const handleTaskDropOnBubble = useCallback(
    async (taskId: number, bubbleId: string) => {
      const todayStr = new Date().toISOString().split("T")[0];
      const payload: Record<string, unknown> = {};
      if (bubbleId === "meu_dia") {
        payload.start_date = todayStr;
      } else if (bubbleId === "importante") {
        payload.is_important = true;
      } else if (bubbleId === "geral") {
        /* nenhuma ação */
      } else if (bubbleId.startsWith("list:")) {
        const listId = parseInt(bubbleId.split(":")[1] || "0", 10);
        payload.list_id = listId || null;
      } else if (bubbleId === "planejado") {
        payload.is_assigned = true;
      }
      if (Object.keys(payload).length > 0) {
        await api.updateTask(taskId, payload);
        onRefresh();
      }
    },
    [onRefresh]
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
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const overStr = String(over.id);
      const activeStr = String(active.id);

      if (overStr.startsWith("bubble-") && !activeStr.startsWith("bubble-")) {
        const bubbleId = overStr.replace("bubble-", "");
        const taskId =
          typeof active.id === "number" ? active.id : parseInt(activeStr, 10);
        if (!isNaN(taskId) && bubbleId) {
          await handleTaskDropOnBubble(taskId, bubbleId);
        }
        return;
      }

      if (activeStr.startsWith("bubble-") && overStr.startsWith("bubble-")) {
        const oldIdx = bubbleOrder.findIndex((id) => `bubble-${id}` === activeStr);
        const newIdx = bubbleOrder.findIndex((id) => `bubble-${id}` === overStr);
        if (oldIdx !== -1 && newIdx !== -1) {
          const reordered = arrayMove(bubbleOrder, oldIdx, newIdx);
          saveBubbleOrder(reordered);
        }
        return;
      }

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
    [pending, bubbleOrder, saveBubbleOrder, handleTaskDropOnBubble, onRefresh]
  );

  const handleToggle = useCallback(
    async (task: Task) => {
      await api.toggleTask(task.id);
      onRefresh();
    },
    [onRefresh]
  );

  const handleDelete = useCallback((taskId: number) => {
    setConfirmDeleteTask(taskId);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!confirmDeleteTask) return;
    await api.deleteTask(confirmDeleteTask);
    if (activeTask?.id === confirmDeleteTask) setActiveTask(null);
    setConfirmDeleteTask(null);
    onRefresh();
  }, [confirmDeleteTask, activeTask, onRefresh]);

  const handleAddStep = useCallback(
    async (task: Task, title: string) => {
      await api.addStep(task.id, title);
      onRefresh();
    },
    [onRefresh]
  );

  const handleToggleStep = useCallback(
    async (task: Task, step: TaskStep) => {
      await api.toggleStep(task.id, step.id);
      onRefresh();
    },
    [onRefresh]
  );

  const handleDeleteStep = useCallback(
    async (task: Task, stepId: number) => {
      await api.deleteStep(task.id, stepId);
      onRefresh();
    },
    [onRefresh]
  );

  const handleColorChange = useCallback(
    async (taskId: number, color: string | null) => {
      await api.updateTask(taskId, { color: color ?? "" });
      onRefresh();
    },
    [onRefresh]
  );

  const handleImportantToggle = useCallback(
    async (taskId: number) => {
      const t = [...pending, ...completed].find((x) => x.id === taskId);
      if (!t) return;
      await api.updateTask(taskId, {
        is_important: !(t.is_important ?? false),
      });
      onRefresh();
    },
    [pending, completed, onRefresh]
  );

  const handleMyDayToggle = useCallback(
    async (taskId: number) => {
      const t = [...pending, ...completed].find((x) => x.id === taskId);
      if (!t) return;
      const todayStr = new Date().toISOString().split("T")[0];
      const isInMyDay = t.start_date && t.start_date <= todayStr;
      await api.updateTask(taskId, {
        start_date: isInMyDay ? "" : todayStr,
      });
      onRefresh();
    },
    [pending, completed, onRefresh]
  );

  const handleSetStartDate = useCallback(
    async (taskId: number, dateStr: string | null) => {
      await api.updateTask(taskId, { start_date: dateStr });
      onRefresh();
    },
    [onRefresh]
  );

  const handleMoveToList = useCallback(
    async (taskId: number, listId: number | null) => {
      await api.updateTask(taskId, { list_id: listId });
      onRefresh();
    },
    [onRefresh]
  );

  useEffect(() => {
    if (!activeTask) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "t") {
        e.preventDefault();
        handleMyDayToggle(activeTask.id);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        handleToggle(activeTask);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTask, handleMyDayToggle, handleToggle]);

  const handleDeleteListRequest = useCallback((listId: number) => {
    setConfirmDeleteList(listId);
  }, []);

  const handleDeleteListConfirm = useCallback(async () => {
    if (!confirmDeleteList) return;
    try {
      await api.deleteTaskList(confirmDeleteList);
      onListsChange(lists.filter((l) => l.id !== confirmDeleteList));
      const newOrder = bubbleOrder.filter(
        (id) => id !== `list:${confirmDeleteList}`
      );
      saveBubbleOrder(newOrder);
      if (taskFilter === `list:${confirmDeleteList}`) {
        onTaskFilterChange("meu_dia");
      }
      onRefresh();
    } catch (e) {
      console.error("Erro ao excluir lista:", e);
    } finally {
      setConfirmDeleteList(null);
    }
  }, [
    confirmDeleteList,
    lists,
    bubbleOrder,
    taskFilter,
    onListsChange,
    saveBubbleOrder,
    onTaskFilterChange,
    onRefresh,
  ]);

  const todayCompleted = completed
    .filter((t) => t.completed_at && t.completed_at.startsWith(todayStr))
    .sort((a, b) => {
      const aAt = a.completed_at || "";
      const bAt = b.completed_at || "";
      return bAt.localeCompare(aAt);
    });

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex h-full flex-col">
          <div className="shrink-0 px-6 pt-6 pb-4">
            <TaskCreator taskFilter={taskFilter} onRefresh={onRefresh} />
            <BubbleRow
              bubbleOrder={bubbleOrder}
              onBubbleOrderChange={saveBubbleOrder}
              taskFilter={taskFilter}
              onTaskFilterChange={onTaskFilterChange}
              lists={lists}
              onListsChange={onListsChange}
              onDeleteListRequest={handleDeleteListRequest}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none px-6 pb-2">
            <SortableContext
              items={pending.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {pending.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  lists={lists}
                  onToggle={() => handleToggle(task)}
                  onDelete={() => handleDelete(task.id)}
                  onClick={() => setActiveTask(task)}
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

            {pending.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20">
                <Sparkles
                  size={40}
                  strokeWidth={1}
                  className="mb-4 text-slate-200 dark:text-zinc-700"
                />
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

        {(() => {
          if (!activeDragId) return null;

          const isDraggingBubble = typeof activeDragId === "string" && activeDragId.startsWith("bubble-");
          const isOverBubbleZone = dragOverId?.startsWith("bubble-") || dragOverId === "drop-bubble-zone";

          return (
            <DragOverlay
              zIndex={999999}
              modifiers={dragOverlayModifiers}
              style={{ pointerEvents: "none" }}
            >
              {isDraggingBubble ? (
                (() => {
                  const bubbleId = (activeDragId as string).replace("bubble-", "");
                  const label = bubbleId.startsWith("list:")
                    ? lists.find((l) => l.id === parseInt(bubbleId.split(":")[1] || "0", 10))?.name ?? "Lista"
                    : DEFAULT_BUBBLES.find((b) => b.id === bubbleId)?.label ?? bubbleId;
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
                })()
              ) : (
                (() => {
                  const task =
                    pending.find((t) => t.id === activeDragId) ||
                    completed.find((t) => t.id === activeDragId);
                  return task ? (
                    <TaskDragOverlay task={task} isOverBubbleZone={isOverBubbleZone} />
                  ) : null;
                })()
              )}
            </DragOverlay>
          );
        })()}
      </DndContext>

      <TaskConfirmModals
        confirmDeleteTask={confirmDeleteTask}
        confirmDeleteList={confirmDeleteList}
        onCancelTask={() => setConfirmDeleteTask(null)}
        onConfirmTask={handleDeleteConfirm}
        onCancelList={() => setConfirmDeleteList(null)}
        onConfirmList={handleDeleteListConfirm}
      />

      <TaskSideSheet
        task={activeTask}
        onClose={() => setActiveTask(null)}
        onRefresh={onRefresh}
        onColorChange={handleColorChange}
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