/**
 * Botões +lista e +grupo com input inline para nome da lista.
 */

import { useState, useRef, useEffect } from "react";
import { List, FolderPlus } from "lucide-react";
import { api } from "../../../../lib/api";
import { TooltipButton } from "../../../ui/TooltipButton";
import type { TaskGroup, TaskFilterValue } from "../helpers/taskHelpers";
import { addGroup } from "../helpers/taskHelpers";

interface BubbleRowActionsProps {
  lists: { id: number; name: string }[];
  groups: TaskGroup[];
  displayOrder: string[];
  onListsChange: (lists: { id: number; name: string }[]) => void;
  onGroupsChange: (groups: TaskGroup[]) => void;
  onBubbleOrderChange: (order: string[]) => void;
  onTaskFilterChange: (filter: TaskFilterValue) => void;
  onNewlyCreatedGroup: (groupId: string) => void;
}

export function BubbleRowActions({
  lists,
  groups,
  displayOrder,
  onListsChange,
  onGroupsChange,
  onBubbleOrderChange,
  onTaskFilterChange,
  onNewlyCreatedGroup,
}: BubbleRowActionsProps) {
  const [creatingNewList, setCreatingNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const newInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creatingNewList) newInputRef.current?.focus();
  }, [creatingNewList]);

  const handleCreateList = async () => {
    const name = newListName.trim() || "Nova Lista";
    setCreatingNewList(false);
    setNewListName("");
    try {
      const created = await api.createTaskList(name);
      onListsChange([...lists, created]);
      onBubbleOrderChange([...displayOrder, `list:${created.id}`]);
      onTaskFilterChange(`list:${created.id}`);
    } catch (e) {
      console.error("Erro ao criar lista:", e);
    }
  };

  const handleCreateGroup = () => {
    const newGroup = { ...addGroup("Novo Grupo"), expanded: true };
    onGroupsChange([...groups, newGroup]);
    onBubbleOrderChange([...displayOrder, `group:${newGroup.id}`]);
    onNewlyCreatedGroup(newGroup.id);
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      {creatingNewList ? (
        <div
          data-no-grab-scroll
          className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-dashed border-slate-300/80 bg-transparent px-3 dark:border-zinc-600/80"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={newInputRef}
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateList();
              if (e.key === "Escape") {
                setCreatingNewList(false);
                setNewListName("");
              }
            }}
            onBlur={() => {
              if (newListName.trim()) handleCreateList();
              else {
                setCreatingNewList(false);
                setNewListName("");
              }
            }}
            placeholder="Nome da lista"
            className="w-28 min-w-0 bg-transparent text-xs font-semibold outline-none placeholder:text-slate-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            data-no-dnd="true"
          />
        </div>
      ) : (
        <TooltipButton
          label="adicionar lista"
          data-no-grab-scroll
          onClick={() => setCreatingNewList(true)}
          className="h-8 w-8 shrink-0 rounded-full border border-dashed border-slate-300/80 bg-transparent text-slate-500 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-600/80 dark:text-zinc-500 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
        >
          <List size={14} strokeWidth={2} />
        </TooltipButton>
      )}
      <TooltipButton
        label="adicionar grupo"
        data-no-grab-scroll
        onClick={handleCreateGroup}
        className="h-8 w-8 shrink-0 rounded-full border border-dashed border-slate-300/80 bg-transparent text-slate-500 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-600/80 dark:text-zinc-500 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
      >
        <FolderPlus size={14} strokeWidth={2} />
      </TooltipButton>
    </div>
  );
}
