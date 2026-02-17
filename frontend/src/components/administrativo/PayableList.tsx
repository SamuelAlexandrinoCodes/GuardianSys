import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  AlertTriangle,
  CreditCard,
} from "lucide-react";
import type { Payable } from "../../types";
import { api } from "../../lib/api";
import { Modal } from "../ui/Modal";

interface PayableListProps {
  payables: Payable[];
  totalOpen: number;
  onRefresh: () => void;
}

export function PayableList({ payables, totalOpen, onRefresh }: PayableListProps) {
  const [showModal, setShowModal] = useState(false);

  const handleToggle = useCallback(
    async (id: number) => {
      await api.togglePayable(id);
      onRefresh();
    },
    [onRefresh]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      await api.deletePayable(id);
      onRefresh();
    },
    [onRefresh]
  );

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-6 pt-6 pb-4">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
            Total em aberto
          </span>
          <p className="mt-0.5 text-2xl font-bold tracking-tight text-red-600 dark:text-red-400">
            R$ {totalOpen.toFixed(2)}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        >
          <Plus size={14} strokeWidth={1.5} />
          Nova Conta
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 border-b border-slate-200/60 bg-slate-50/90 backdrop-blur-sm dark:border-white/[0.06] dark:bg-zinc-900/90">
            <tr>
              <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
                Descricao
              </th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
                Vencimento
              </th>
              <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
                Valor
              </th>
              <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
                Status
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/60 dark:divide-white/[0.04]">
            <AnimatePresence mode="popLayout">
              {payables.map((p) => {
                const isOverdue =
                  p.due_date < todayStr && p.status === "ABERTO";

                return (
                  <motion.tr
                    key={p.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="group transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/30"
                  >
                    <td className="px-6 py-3.5">
                      <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                        {p.description}
                      </span>
                      {p.payee && (
                        <span className="mt-0.5 block text-[11px] font-medium text-slate-400 dark:text-zinc-500">
                          {p.payee}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          isOverdue
                            ? "text-red-600 dark:text-red-400"
                            : "text-slate-600 dark:text-zinc-400"
                        }`}
                      >
                        {isOverdue && (
                          <AlertTriangle size={11} strokeWidth={2} />
                        )}
                        {new Date(p.due_date + "T00:00:00").toLocaleDateString(
                          "pt-BR"
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm font-bold text-slate-800 dark:text-zinc-200">
                      R$ {p.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => handleToggle(p.id)}
                        className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                          p.status === "PAGO"
                            ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400"
                            : "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400"
                        }`}
                      >
                        {p.status}
                      </button>
                    </td>
                    <td className="px-3 py-3.5">
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-slate-200 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400 dark:text-zinc-700 dark:hover:text-red-400"
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>

        {payables.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <CreditCard
              size={40}
              strokeWidth={1}
              className="mb-4 text-slate-200 dark:text-zinc-700"
            />
            <p className="text-sm font-bold tracking-tight text-slate-300 dark:text-zinc-600">
              Nenhuma conta cadastrada.
            </p>
          </div>
        )}
      </div>

      {/* Create modal */}
      <CreatePayableModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onRefresh={onRefresh}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create payable modal
// ---------------------------------------------------------------------------

function CreatePayableModal({
  open,
  onClose,
  onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [description, setDescription] = useState("");
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [regularity, setRegularity] = useState("MENSAL");

  const handleSubmit = async () => {
    if (!description.trim() || !amount || !dueDate) return;
    await api.createPayable({
      description: description.trim(),
      payee: payee.trim() || null,
      amount: parseFloat(amount),
      due_date: dueDate,
      regularity,
    });
    setDescription("");
    setPayee("");
    setAmount("");
    setDueDate("");
    setRegularity("MENSAL");
    onClose();
    onRefresh();
  };

  return (
    <Modal open={open} onClose={onClose} title="Nova Conta a Pagar">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
            Descricao
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Luz - Dezembro"
            className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
              Valor (R$)
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
              Vencimento
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
              Para quem
            </label>
            <input
              type="text"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
              Regularidade
            </label>
            <select
              value={regularity}
              onChange={(e) => setRegularity(e.target.value)}
              className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200"
            >
              <option value="MENSAL">Mensal</option>
              <option value="ANUAL">Anual</option>
              <option value="IRREGULAR">Irregular</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-xl px-5 py-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}
