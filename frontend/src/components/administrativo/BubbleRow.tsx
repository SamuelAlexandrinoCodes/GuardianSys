import { useState, useRef, useCallback, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, X } from "lucide-react";
import { api } from "../../lib/api";
import {
  type TaskFilterValue,
  DEFAULT_BUBBLES,
} from "./taskHelpers";

/* ========================================================================== */
/* SortableDroppableBubble                                                    */
/* ========================================================================== */

function SortableDroppableBubble({
  id,
  label,
  isActive,
  onClick,
  onDelete,
}: {
  id: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: `bubble-${id}` });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      data-no-grab-scroll
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`relative flex h-8 shrink-0 cursor-grab select-none items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-xs font-semibold transition-all duration-200 active:cursor-grabbing border-2 border-green-500 ${
        isActive
          ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/30 dark:bg-indigo-500"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      } ${isDragging ? "opacity-80 ring-2 ring-indigo-400/50" : ""} ${
        isOver
          ? "z-50 scale-105 bg-blue-500/20 text-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.6)] dark:text-blue-400"
          : ""
      }`}
    >
      <span className="min-w-0 truncate">{label}</span>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="-mr-1.5 ml-1 flex h-4 w-4 items-center justify-center rounded-full opacity-60 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
          aria-label="Remover lista"
        >
          <X size={10} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

/* ========================================================================== */
/* BubbleRow                                                                  */
/* ========================================================================== */

export interface BubbleRowProps {
  bubbleOrder: string[];
  onBubbleOrderChange: (order: string[]) => void;
  taskFilter: TaskFilterValue;
  onTaskFilterChange: (filter: TaskFilterValue) => void;
  lists: { id: number; name: string }[];
  onListsChange: (lists: { id: number; name: string }[]) => void;
  onDeleteListRequest: (listId: number) => void;
}

export function BubbleRow({
  bubbleOrder,
  onBubbleOrderChange,
  taskFilter,
  onTaskFilterChange,
  lists,
  onListsChange,
  onDeleteListRequest,
}: BubbleRowProps) {
  const [creatingNew, setCreatingNew] = useState(false);
  const [newListName, setNewListName] = useState("");
  const newInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const grabState = useRef({ isGrabbing: false, startX: 0, startScrollLeft: 0 });

  const handleGrabStart = useCallback((e: React.MouseEvent) => {
    if (
      e.target instanceof Element &&
      (e.target.closest("[data-no-grab-scroll]") || e.target.closest("button"))
    )
      return;
    if (!scrollRef.current) return;
    grabState.current = {
      isGrabbing: true,
      startX: e.clientX,
      startScrollLeft: scrollRef.current.scrollLeft,
    };
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      const state = grabState.current;
      if (!state.isGrabbing || !scrollRef.current) return;
      scrollRef.current.scrollLeft = state.startScrollLeft - (ev.clientX - state.startX);
    };

    const onEnd = () => {
      grabState.current.isGrabbing = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("mouseleave", onEnd);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("mouseleave", onEnd);
  }, []);

  const bubbleItems = bubbleOrder
    .filter((id) => {
      if (id.startsWith("list:")) {
        const listId = parseInt(id.split(":")[1] || "0", 10);
        return lists.some((l) => l.id === listId);
      }
      return DEFAULT_BUBBLES.some((b) => b.id === id);
    })
    .map((id) => ({
      id,
      label: id.startsWith("list:")
        ? lists.find((l) => l.id === parseInt(id.split(":")[1] || "0", 10))?.name ?? "Lista"
        : DEFAULT_BUBBLES.find((b) => b.id === id)?.label ?? id,
    }));

  const handleCreateList = useCallback(async () => {
    const name = newListName.trim() || "Nova Lista";
    setCreatingNew(false);
    setNewListName("");
    try {
      const created = await api.createTaskList(name);
      onListsChange([...lists, created]);
      onBubbleOrderChange([...bubbleOrder, `list:${created.id}`]);
      onTaskFilterChange(`list:${created.id}`);
    } catch (e) {
      console.error("Erro ao criar lista:", e);
    }
  }, [newListName, lists, bubbleOrder, onListsChange, onBubbleOrderChange, onTaskFilterChange]);

  const handleDeleteListClick = useCallback(
    (listId: number) => {
      onDeleteListRequest(listId);
    },
    [onDeleteListRequest]
  );

  useEffect(() => {
    if (creatingNew) newInputRef.current?.focus();
  }, [creatingNew]);

  const { setNodeRef: setZoneRef } = useDroppable({ id: "drop-bubble-zone" });

  return (
    <div
      ref={setZoneRef}
      onMouseDown={handleGrabStart}
      className="mt-4 flex w-full cursor-grab items-center gap-3 active:cursor-grabbing border-2 border-red-500"
    >
      {/*
        overflow-x-auto sozinho faz o browser promover overflow-y de "visible" para "auto"
        pelo spec CSS. overflow-y-hidden garante explicitamente que não há scroll no eixo Y.
        isolate cria um novo stacking context para que os transforms do dnd-kit não
        "vazem" visualmente para fora do trilho.
      */}
      <div
        ref={scrollRef}
        className="isolate flex h-12 min-w-0 flex-1 flex-nowrap items-center gap-2.5 overflow-x-auto overflow-y-hidden px-1 scrollbar-hide border-2 border-blue-500"
      >
        <SortableContext
          items={bubbleItems.map((b) => `bubble-${b.id}`)}
          strategy={horizontalListSortingStrategy}
        >
          {bubbleItems.map(({ id, label }) => (
            <SortableDroppableBubble
              key={id}
              id={id}
              label={label}
              isActive={taskFilter === id}
              onClick={() => onTaskFilterChange(id as TaskFilterValue)}
              onDelete={
                id.startsWith("list:")
                  ? () => handleDeleteListClick(parseInt(id.split(":")[1] || "0", 10))
                  : undefined
              }
            />
          ))}
        </SortableContext>
      </div>

      {creatingNew ? (
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
                setCreatingNew(false);
                setNewListName("");
              }
            }}
            onBlur={() => {
              if (newListName.trim()) handleCreateList();
              else {
                setCreatingNew(false);
                setNewListName("");
              }
            }}
            placeholder="Nome da lista"
            className="w-28 min-w-0 bg-transparent text-xs font-semibold outline-none placeholder:text-slate-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            data-no-dnd="true"
          />
        </div>
      ) : (
        <button
          type="button"
          data-no-grab-scroll
          onClick={() => setCreatingNew(true)}
          className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-dashed border-slate-300/80 bg-transparent px-4 text-xs font-semibold text-slate-500 transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-600/80 dark:text-zinc-500 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
        >
          <Plus size={14} strokeWidth={2} className="-ml-1" />
          Lista
        </button>
      )}
    </div>
  );
}
