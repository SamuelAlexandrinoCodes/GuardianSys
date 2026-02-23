import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  CheckSquare,
  Users,
  CreditCard,
  Wallet,
  Loader2,
} from "lucide-react";
import type { AdministrativoData } from "../types";
import { api } from "../lib/api";
import { TaskBoard, type TaskFilterValue } from "../components/administrativo/TaskBoard";
import { MeetingAgenda } from "../components/administrativo/MeetingAgenda";
import { PayableList } from "../components/administrativo/PayableList";
import { FinancePage } from "./FinancePage";

const tabs = [
  { id: "tarefas", label: "Tarefas", icon: CheckSquare },
  { id: "reunioes", label: "Reunioes", icon: Users },
  { id: "contas", label: "Contas a Pagar", icon: CreditCard },
  { id: "financeiro", label: "Financeiro Geral", icon: Wallet },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function AdministrativoPage() {
  const [activeTab, setActiveTab] = useState<TabId>("tarefas");
  const [taskFilter, setTaskFilter] = useState<TaskFilterValue>("meu_dia");
  const [data, setData] = useState<AdministrativoData | null>(null);
  const [lists, setLists] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const needsAdminData = activeTab !== "financeiro";

  const fetchData = useCallback(async () => {
    if (!needsAdminData) { setLoading(false); return; }
    try {
      const [adminResult, listsResult] = await Promise.all([
        api.getAdministrativo(activeTab, taskFilter),
        activeTab === "tarefas" ? api.getTaskLists() : Promise.resolve([]),
      ]);
      setData(adminResult);
      if (activeTab === "tarefas" && Array.isArray(listsResult)) {
        setLists(listsResult);
      }
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, needsAdminData, taskFilter]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex shrink-0 items-center justify-center gap-1.5 border-b border-slate-200/60 bg-white px-6 py-3 dark:border-white/[0.06] dark:bg-zinc-950">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`relative flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-semibold transition-colors ${
              activeTab === id
                ? "text-slate-900 dark:text-zinc-100"
                : "text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-400"
            }`}
          >
            {activeTab === id && (
              <motion.div
                layoutId="admin-tab-pill"
                className="absolute inset-0 rounded-xl bg-slate-100 dark:bg-zinc-800/80"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Icon size={14} strokeWidth={1.5} />
              <span className="uppercase tracking-[0.15em]">{label}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "financeiro" ? (
          <FinancePage />
        ) : loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2
              size={24}
              strokeWidth={1.5}
              className="animate-spin text-slate-300 dark:text-zinc-600"
            />
          </div>
        ) : !data ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm font-semibold text-slate-300 dark:text-zinc-600">
              Erro ao carregar dados.
            </p>
          </div>
        ) : (
          <div className="h-full">
            {activeTab === "tarefas" && (
              <TaskBoard
                pending={data.tasks_pending}
                completed={data.tasks_completed}
                taskFilter={taskFilter}
                onTaskFilterChange={setTaskFilter}
                lists={lists}
                onListsChange={setLists}
                onRefresh={handleRefresh}
              />
            )}
            {activeTab === "reunioes" && (
              <MeetingAgenda
                meetings={data.meetings}
                onRefresh={handleRefresh}
              />
            )}
            {activeTab === "contas" && (
              <PayableList
                payables={data.payables}
                totalOpen={data.total_open}
                onRefresh={handleRefresh}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
