import * as ContextMenu from "@radix-ui/react-context-menu";
import { ChevronRight, Pencil, Trash2, FolderPlus, FolderOpen } from "lucide-react";
import type { TaskGroup } from "../../helpers/taskHelpers";

export type BubbleType = "filter" | "list" | "group";

export interface BubbleContextMenuProps {
  bubbleId: string;
  bubbleLabel?: string;
  bubbleType: BubbleType;
  groups: TaskGroup[];
  lists?: { id: number; name: string }[];
  children: React.ReactNode;
  /** Para listas e grupos */
  onRename?: () => void;
  /** Apenas para listas */
  onDelete?: () => void;
  /** Para listas: mover para grupo */
  onMoveToGroup?: (groupId: string) => void;
  /** Para grupos */
  onUngroup?: () => void;
  /** Para grupos: adicionar nova lista */
  onAddListToGroup?: () => void;
}

export function BubbleContextMenu({
  bubbleId,
  bubbleType,
  groups,
  children,
  onRename,
  onDelete,
  onMoveToGroup,
  onUngroup,
  onAddListToGroup,
}: BubbleContextMenuProps) {
  const otherGroups = groups.filter((g) => `group:${g.id}` !== bubbleId);

  if (bubbleType === "filter") {
    return <>{children}</>;
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="z-[9999] min-w-[200px] rounded-xl border border-white/10 bg-zinc-900 py-1 shadow-xl"
          style={{
            background: "rgb(var(--menu-bg))",
            color: "rgb(var(--menu-text))",
          }}
        >
          {bubbleType === "list" && (
            <>
              {otherGroups.length > 0 && onMoveToGroup && (
                <ContextMenu.Sub>
                  <ContextMenu.SubTrigger className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white data-[state=open]:bg-indigo-500/30 data-[state=open]:text-white">
                    <FolderOpen size={14} strokeWidth={1.5} />
                    Mover para grupo
                    <ChevronRight size={12} className="ml-auto" />
                  </ContextMenu.SubTrigger>
                  <ContextMenu.Portal>
                    <ContextMenu.SubContent
                      className="z-[10000] max-h-[240px] min-w-[160px] overflow-y-auto rounded-xl border border-white/10 bg-zinc-900 py-1 shadow-xl"
                    >
                      {otherGroups.map((g) => (
                        <ContextMenu.Item
                          key={g.id}
                          className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white"
                          onSelect={() => onMoveToGroup(g.id)}
                        >
                          {g.name}
                        </ContextMenu.Item>
                      ))}
                    </ContextMenu.SubContent>
                  </ContextMenu.Portal>
                </ContextMenu.Sub>
              )}
              {onRename && (
                <ContextMenu.Item
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white"
                  onSelect={onRename}
                >
                  <Pencil size={14} strokeWidth={1.5} />
                  Renomear
                </ContextMenu.Item>
              )}
              {onDelete && (
                <ContextMenu.Item
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-red-400 outline-none hover:bg-red-500/20 hover:text-red-300 data-[highlighted]:bg-red-500/20 data-[highlighted]:text-red-300"
                  onSelect={onDelete}
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                  Eliminar
                </ContextMenu.Item>
              )}
            </>
          )}

          {bubbleType === "group" && (
            <>
              {onUngroup && (
                <ContextMenu.Item
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white"
                  onSelect={onUngroup}
                >
                  <FolderOpen size={14} strokeWidth={1.5} />
                  Desgrupar
                </ContextMenu.Item>
              )}
              {onRename && (
                <ContextMenu.Item
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white"
                  onSelect={onRename}
                >
                  <Pencil size={14} strokeWidth={1.5} />
                  Renomear
                </ContextMenu.Item>
              )}
              {onAddListToGroup && (
                <ContextMenu.Item
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white"
                  onSelect={onAddListToGroup}
                >
                  <FolderPlus size={14} strokeWidth={1.5} />
                  Adicionar nova lista
                </ContextMenu.Item>
              )}
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
