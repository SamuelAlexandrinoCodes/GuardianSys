import * as ContextMenu from "@radix-ui/react-context-menu";
import { Check, ChevronRight, Trash2, CalendarDays, Star, Sun } from "lucide-react";
import type { Task } from "../../../types";

/* ========================================================================== */
/* TaskContextMenu                                                            */
/* ========================================================================== */

export interface TaskContextMenuProps {
  task: Task;
  lists: { id: number; name: string }[];
  children: React.ReactNode;
  onMyDayAdd: () => void;
  onImportantToggle: () => void;
  onToggle: () => void;
  onSetStartDate: (date: string | null) => void;
  onMoveToList: (listId: number | null) => void;
  onDelete: () => void;
  onOpenSideSheet: () => void;
}

export function TaskContextMenu({
  task,
  lists,
  children,
  onMyDayAdd,
  onImportantToggle,
  onToggle,
  onSetStartDate,
  onMoveToList,
  onDelete,
  onOpenSideSheet,
}: TaskContextMenuProps) {
  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  const isInMyDay = task.start_date && task.start_date <= todayStr;

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
          <ContextMenu.Item
            className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white"
            onSelect={() => onMyDayAdd()}
          >
            <Sun size={14} strokeWidth={1.5} />
            {isInMyDay ? "Remover do Meu Dia" : "Adicionar ao Meu Dia"}
            <span className="ml-auto text-[10px] text-zinc-400">Ctrl+T</span>
          </ContextMenu.Item>
          <ContextMenu.Item
            className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white"
            onSelect={() => onImportantToggle()}
          >
            <Star
              size={14}
              strokeWidth={1.5}
              className={task.is_important ? "fill-amber-400 text-amber-400" : ""}
            />
            {task.is_important
              ? "Remover destaque"
              : "Marcar como importante"}
          </ContextMenu.Item>
          <ContextMenu.Item
            className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white"
            onSelect={() => onToggle()}
          >
            <Check size={14} strokeWidth={1.5} />
            Marcar como concluída
            <span className="ml-auto text-[10px] text-zinc-400">Ctrl+D</span>
          </ContextMenu.Item>
          <ContextMenu.Separator className="my-1 h-px bg-zinc-700" />
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white data-[state=open]:bg-indigo-500/30 data-[state=open]:text-white">
              <CalendarDays size={14} strokeWidth={1.5} />
              Data de início
              <ChevronRight size={12} className="ml-auto" />
            </ContextMenu.SubTrigger>
            <ContextMenu.Portal>
              <ContextMenu.SubContent
                className="z-[10000] min-w-[160px] rounded-xl border border-white/10 bg-zinc-900 py-1 shadow-xl"
              >
                <ContextMenu.Item
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white"
                  onSelect={() => onSetStartDate(todayStr)}
                >
                  Hoje
                </ContextMenu.Item>
                <ContextMenu.Item
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white"
                  onSelect={() => onSetStartDate(tomorrowStr)}
                >
                  Amanhã
                </ContextMenu.Item>
                <ContextMenu.Item
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white"
                  onSelect={() => onSetStartDate(null)}
                >
                  Remover data
                </ContextMenu.Item>
                <ContextMenu.Separator className="my-1 h-px bg-zinc-700" />
                <ContextMenu.Item
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white"
                  onSelect={() => onOpenSideSheet()}
                >
                  Selecionar data...
                </ContextMenu.Item>
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>
          {lists.length > 0 && (
            <ContextMenu.Sub>
              <ContextMenu.SubTrigger className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white data-[state=open]:bg-indigo-500/30 data-[state=open]:text-white">
                <span>📂</span>
                Mover tarefa para...
                <ChevronRight size={12} className="ml-auto" />
              </ContextMenu.SubTrigger>
              <ContextMenu.Portal>
                <ContextMenu.SubContent
                  className="z-[10000] max-h-[240px] min-w-[160px] overflow-y-auto rounded-xl border border-white/10 bg-zinc-900 py-1 shadow-xl"
                >
                  {lists.map((l) => (
                    <ContextMenu.Item
                      key={l.id}
                      className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-zinc-100 outline-none hover:bg-indigo-500/30 hover:text-white data-[highlighted]:bg-indigo-500/30 data-[highlighted]:text-white"
                      onSelect={() => onMoveToList(l.id)}
                    >
                      {l.name}
                    </ContextMenu.Item>
                  ))}
                </ContextMenu.SubContent>
              </ContextMenu.Portal>
            </ContextMenu.Sub>
          )}
          <ContextMenu.Separator className="my-1 h-px bg-zinc-700" />
          <ContextMenu.Item
            className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-red-400 outline-none hover:bg-red-500/20 hover:text-red-300 data-[highlighted]:bg-red-500/20 data-[highlighted]:text-red-300"
            onSelect={() => onDelete()}
          >
            <Trash2 size={14} strokeWidth={1.5} />
            Excluir tarefa
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
