/**
 * Handlers de tarefa para GroupBubble (toggle, delete, etc).
 */

import type { Task, TaskStep } from "../../../../../types";
import { api } from "../../../../../lib/api";

export function useGroupTaskHandlers(
  tasksInGroup: Task[],
  onRefresh: () => void
) {
  return {
    onToggle: async (task: Task) => {
      await api.toggleTask(task.id);
      onRefresh();
    },
    onDelete: (taskId: number) => {
      api.deleteTask(taskId).then(onRefresh);
    },
    onImportantToggle: async (taskId: number) => {
      const t = tasksInGroup.find((x) => x.id === taskId);
      if (!t) return;
      await api.updateTask(taskId, { is_important: !(t.is_important ?? false) });
      onRefresh();
    },
    onMyDayToggle: async (taskId: number) => {
      const t = tasksInGroup.find((x) => x.id === taskId);
      if (!t) return;
      const todayStr = new Date().toISOString().split("T")[0];
      const isInMyDay = t.start_date && t.start_date <= todayStr;
      await api.updateTask(taskId, { start_date: isInMyDay ? "" : todayStr });
      onRefresh();
    },
    onSetStartDate: async (taskId: number, dateStr: string | null) => {
      await api.updateTask(taskId, { start_date: dateStr });
      onRefresh();
    },
    onMoveToList: async (taskId: number, listId: number | null) => {
      await api.updateTask(taskId, { list_id: listId });
      onRefresh();
    },
    onColorChange: async (taskId: number, color: string | null) => {
      await api.updateTask(taskId, { color: color ?? "" });
      onRefresh();
    },
    onTitleChange: async (task: Task, newTitle: string) => {
      await api.updateTask(task.id, { title: newTitle });
      onRefresh();
    },
    onAddStep: async (task: Task, title: string) => {
      await api.addStep(task.id, title);
      onRefresh();
    },
    onToggleStep: async (task: Task, step: TaskStep) => {
      await api.toggleStep(task.id, step.id);
      onRefresh();
    },
    onDeleteStep: async (task: Task, stepId: number) => {
      await api.deleteStep(task.id, stepId);
      onRefresh();
    },
  };
}
