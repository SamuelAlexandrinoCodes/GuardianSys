/**
 * Chip sortable (filtro ou lista) na barra de bubbles.
 * Filtros: sem menu de contexto. Listas: envolvidas em BubbleContextMenu.
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X } from "lucide-react";
import { AutoSizeInput } from "../../../ui/AutoSizeInput";
import { BubbleContextMenu } from "./context/BubbleContextMenu";
import type { TaskGroup } from "../helpers/taskHelpers";

interface SortableBubbleProps {
  id: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
  onDelete?: () => void;
  onRequestRename?: () => void;
  bubbleType: "filter" | "list";
  groups: TaskGroup[];
  lists: { id: number; name: string }[];
  onMoveToGroup?: (groupId: string) => void;
  isEditing?: boolean;
  editValue?: string;
  onEditChange?: (value: string) => void;
  onEditCommit?: () => void;
  onEditCancel?: () => void;
}

export function SortableBubble({
  id,
  label,
  isActive,
  onClick,
  onDelete,
  onRequestRename,
  bubbleType,
  groups,
  lists,
  onMoveToGroup,
  isEditing,
  editValue,
  onEditChange,
  onEditCommit,
  onEditCancel,
}: SortableBubbleProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
    isOver,
  } = useSortable({ id: `bubble-${id}` });

  const otherGroups = groups.filter((g) => `group:${g.id}` !== id);

  const bubbleContent = (
    <div
      ref={setNodeRef}
      data-no-grab-scroll
      data-bubble-type={bubbleType}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: "none",
        opacity: isDragging ? 0.4 : 1,
      }}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        if (!isEditing) onClick();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (onRequestRename && bubbleType === "list") onRequestRename();
      }}
      className={`relative flex h-8 shrink-0 cursor-grab select-none items-center gap-1 whitespace-nowrap rounded-full text-xs font-semibold transition-all duration-200 active:cursor-grabbing ${
        isEditing ? "px-2" : "px-3 pr-2"
      } ${
        isActive
          ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/30 dark:bg-indigo-500"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      } ${isDragging ? "opacity-80 ring-2 ring-indigo-400/50" : ""} ${
        isOver
          ? "z-50 scale-105 bg-blue-500/20 text-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.6)] dark:text-blue-400"
          : ""
      }`}
    >
      {isEditing && onEditChange && onEditCommit && onEditCancel ? (
        <AutoSizeInput
          value={editValue ?? label}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEditCommit();
            if (e.key === "Escape") onEditCancel();
          }}
          onBlur={() => {
            if ((editValue ?? label).trim()) onEditCommit();
            else onEditCancel();
          }}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 bg-transparent text-xs font-semibold outline-none"
          autoFocus
          data-no-dnd="true"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate">{label}</span>
      )}
      {onDelete && !isEditing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="-mr-0.5 ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full opacity-50 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
          aria-label="Remover lista"
        >
          <X size={10} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );

  if (bubbleType === "list") {
    return (
      <BubbleContextMenu
        bubbleId={id}
        bubbleLabel={label}
        bubbleType="list"
        groups={groups}
        lists={lists}
        onRename={onRequestRename}
        onDelete={onDelete}
        onMoveToGroup={
          otherGroups.length > 0 && onMoveToGroup
            ? (gId) => onMoveToGroup(gId)
            : undefined
        }
      >
        {bubbleContent}
      </BubbleContextMenu>
    );
  }

  return bubbleContent;
}
