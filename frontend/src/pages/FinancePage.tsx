import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  CreditCard,
} from "lucide-react";
import type { FinancePayable, FinanceMetrics } from "../types";
import { api } from "../lib/api";
import { Modal } from "../components/ui/Modal";

export function FinancePage() {
  const [payables, setPayables] = useState<FinancePayable[]>([]);
  const [metrics, setMetrics] = useState<FinanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<"all" | "ABERTO" | "PAGO">("all");

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getFinance();
      setPayables(res.payables);
      setMetrics(res.metrics);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = filter === "all" ? payables : payables.filter((p) => p.status === filter);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 size={24} className="animate-spin text-slate-300 dark:text-zinc-600" /></div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200/60 bg-white px-8 py-4 dark:border-white/[0.06] dark:bg-zinc-950">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">Financeiro</h1>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Contas a pagar</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
          <Plus size={14} strokeWidth={2} /> Nova Conta
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none">
        <div className="mx-auto max-w-5xl px-8 py-6">
          {/* KPI Cards */}
          {metrics && (
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <MetricCard icon={AlertTriangle} label="Em Aberto" value={`R$ ${metrics.total_open.toFixed(2)}`} sub={`${metrics.count_open} conta(s)`} color="text-red-600 dark:text-red-400" bg="bg-red-50 dark:bg-red-500/10" />
              <MetricCard icon={CheckCircle2} label="Total Pago" value={`R$ ${metrics.total_paid.toFixed(2)}`} sub={`${metrics.count_paid} conta(s)`} color="text-emerald-600 dark:text-emerald-400" bg="bg-emerald-50 dark:bg-emerald-500/10" />
              <MetricCard icon={metrics.balance >= 0 ? TrendingUp : TrendingDown} label="Balanco" value={`R$ ${Math.abs(metrics.balance).toFixed(2)}`} sub={metrics.balance >= 0 ? "Positivo" : "Negativo"} color={metrics.balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"} bg={metrics.balance >= 0 ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-red-50 dark:bg-red-500/10"} />
              <MetricCard icon={CreditCard} label="Total Geral" value={`R$ ${(metrics.total_open + metrics.total_paid).toFixed(2)}`} sub={`${metrics.count_open + metrics.count_paid} lançamento(s)`} color="text-slate-600 dark:text-zinc-400" bg="bg-slate-50 dark:bg-zinc-800" />
            </div>
          )}

          {/* Filter */}
          <div className="mb-4 flex gap-1">
            {([["all", "Todas"], ["ABERTO", "Em Aberto"], ["PAGO", "Pagas"]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${filter === key ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-slate-400 hover:bg-slate-100 dark:text-zinc-500 dark:hover:bg-zinc-800"}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-white/[0.06] dark:bg-zinc-900">
            {/* Sticky header */}
            <div className="sticky top-0 z-10 grid grid-cols-[1fr_100px_110px_90px_80px_40px] gap-4 border-b border-slate-100/80 bg-white/80 px-5 py-3 backdrop-blur-sm dark:border-white/[0.04] dark:bg-zinc-900/80">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Descricao</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500 text-right">Valor</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500 text-center">Vencimento</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500 text-center">Status</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500 text-center">Acao</span>
              <span />
            </div>
            <div className="divide-y divide-slate-100/60 dark:divide-white/[0.04]">
              <AnimatePresence mode="popLayout">
                {filtered.map((p) => (
                  <PayableRow key={p.id} payable={p} onRefresh={fetchData} />
                ))}
              </AnimatePresence>
              {filtered.length === 0 && (
                <div className="flex items-center justify-center py-12">
                  <p className="text-xs font-semibold text-slate-300 dark:text-zinc-600">Nenhum lancamento.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CreatePayableModal open={showCreate} onClose={() => setShowCreate(false)} onRefresh={fetchData} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric Card
// ---------------------------------------------------------------------------

function MetricCard({ icon: Icon, label, value, sub, color, bg }: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string; value: string; sub: string; color: string; bg: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-white/[0.06] dark:bg-zinc-900">
      <div className="mb-2 flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${bg}`}>
          <Icon size={14} strokeWidth={1.5} className={color} />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">{label}</span>
      </div>
      <p className={`text-xl font-bold tracking-tight ${color}`}>{value}</p>
      <p className="mt-0.5 text-[10px] font-medium text-slate-400 dark:text-zinc-500">{sub}</p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Payable Row
// ---------------------------------------------------------------------------

function PayableRow({ payable: p, onRefresh }: { payable: FinancePayable; onRefresh: () => void }) {
  const isOpen = p.status === "ABERTO";
  const isOverdue = isOpen && new Date(p.due_date + "T00:00:00") < new Date();

  const toggle = async () => { await api.toggleFinancePayable(p.id); onRefresh(); };
  const remove = async () => { await api.deleteFinancePayable(p.id); onRefresh(); };

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="group grid grid-cols-[1fr_100px_110px_90px_80px_40px] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50/50 dark:hover:bg-zinc-800/30"
    >
      {/* Description */}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-700 dark:text-zinc-300">{p.description}</p>
        {p.payee && <p className="truncate text-[10px] text-slate-400 dark:text-zinc-500">{p.payee}</p>}
      </div>

      {/* Amount */}
      <p className={`text-right text-sm font-bold tabular-nums ${isOpen ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-zinc-400"}`}>
        R$ {p.amount.toFixed(2)}
      </p>

      {/* Due date */}
      <p className={`text-center text-xs font-semibold ${isOverdue ? "text-red-500" : "text-slate-500 dark:text-zinc-500"}`}>
        {new Date(p.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
      </p>

      {/* Status */}
      <div className="flex justify-center">
        <span className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${isOpen ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"}`}>
          {p.status}
        </span>
      </div>

      {/* Toggle action */}
      <div className="flex justify-center">
        <button onClick={toggle} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300" title={isOpen ? "Marcar como pago" : "Reabrir"}>
          {isOpen ? <CheckCircle2 size={14} strokeWidth={1.5} /> : <RotateCcw size={14} strokeWidth={1.5} />}
        </button>
      </div>

      {/* Delete */}
      <div className="flex justify-center">
        <button onClick={remove} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-200 opacity-0 transition-all group-hover:opacity-100 hover:text-red-400 dark:text-zinc-700 dark:hover:text-red-400">
          <Trash2 size={13} strokeWidth={1.5} />
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Create Modal
// ---------------------------------------------------------------------------

function CreatePayableModal({ open, onClose, onRefresh }: {
  open: boolean; onClose: () => void; onRefresh: () => void;
}) {
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [payee, setPayee] = useState("");

  const submit = async () => {
    if (!desc.trim() || !amount || !due) return;
    await api.createFinancePayable({ description: desc.trim(), amount: parseFloat(amount), due_date: due, payee: payee || null });
    setDesc(""); setAmount(""); setDue(""); setPayee("");
    onClose(); onRefresh();
  };

  return (
    <Modal open={open} onClose={onClose} title="Nova Conta a Pagar">
      <div className="space-y-4">
        <FInput label="Descricao" value={desc} onChange={setDesc} placeholder="Ex: Conta de energia" />
        <div className="grid grid-cols-2 gap-3">
          <FInput label="Valor (R$)" value={amount} onChange={setAmount} placeholder="0.00" type="number" />
          <FInput label="Vencimento" value={due} onChange={setDue} type="date" />
        </div>
        <FInput label="Beneficiario" value={payee} onChange={setPayee} placeholder="Opcional" />
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl px-5 py-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800">Cancelar</button>
          <button onClick={submit} className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">Salvar</button>
        </div>
      </div>
    </Modal>
  );
}

function FInput({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-300 focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-600" />
    </div>
  );
}
