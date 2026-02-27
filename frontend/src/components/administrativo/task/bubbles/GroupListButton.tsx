/**
 * Botão sortable de lista dentro de grupo.
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X } from "lucide-react";

export function groupListSortableId(groupId: string, listId: number): string {
  return `group-list:${groupId}:${listId}`;
}

interface GroupListButtonProps {
  groupId: string;
  listId: number;
  listName: string;
  isActive: boolean;
  onSelect: () => void;
  onRemove?: () => void;
}

export function GroupListButton({
  groupId,
  listId,
  listName,
  isActive,
  onSelect,
  onRemove,
}: GroupListButtonProps) {
  const sortableId = groupListSortableId(groupId, listId);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useSortable({ id: sortableId });

  return (
    <div
      ref={setNodeRef}
      data-no-grab-scroll
      style={{
        transform: CSS.Transform.toString(transform),
        transition: "none",
        opacity: isDragging ? 0.4 : 1,
      }}
      {...attributes}
      {...listeners}
      className="shrink-0"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className={`flex h-8 w-full min-w-0 shrink-0 cursor-grab items-center gap-1 rounded-full px-3 pr-2 text-xs font-semibold transition-all active:cursor-grabbing ${
          isActive
            ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/30 dark:bg-indigo-500"
            : "bg-white text-slate-600 shadow-sm hover:bg-slate-100 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
        } ${isDragging ? "ring-2 ring-indigo-400/50" : ""}`}
      >
        <span className="min-w-0 flex-1 truncate text-left">{listName}</span>
        {onRemove && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onRemove();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onRemove();
              }
            }}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full opacity-50 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
            aria-label="Remover lista do grupo"
          >
            <X size={10} strokeWidth={2.5} />
          </span>
        )}
      </button>
    </div>
  );
}
