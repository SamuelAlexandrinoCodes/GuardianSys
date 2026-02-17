import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Database,
  HardDrive,
  Clock,
  Download,
  Upload,
  AlertTriangle,
  RotateCcw,
  Building2,
  Users,
  CalendarDays,
  CheckCircle2,
  Handshake,
  CreditCard,
  Package,
} from "lucide-react";
import type { SystemInfo } from "../types";
import { api } from "../lib/api";
import { Modal } from "../components/ui/Modal";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function BackupPage() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRestore, setShowRestore] = useState(false);
  const [showFixStatus, setShowFixStatus] = useState(false);

  const fetchInfo = useCallback(async () => {
    try {
      const res = await api.getSystemInfo();
      setInfo(res);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchInfo(); }, [fetchInfo]);

  const downloadBackup = () => {
    window.open("/api/system/backup", "_blank");
  };

  if (loading || !info) {
    return <div className="flex h-full items-center justify-center"><Loader2 size={24} className="animate-spin text-slate-300 dark:text-zinc-600" /></div>;
  }

  const statItems = [
    { icon: Building2, label: "Unidades", value: info.counts.units },
    { icon: Users, label: "Moradores", value: info.counts.residents },
    { icon: CalendarDays, label: "Reservas", value: info.counts.reservations },
    { icon: CheckCircle2, label: "Tarefas", value: info.counts.tasks },
    { icon: Handshake, label: "Reunioes", value: info.counts.meetings },
    { icon: CreditCard, label: "Contas", value: info.counts.payables },
    { icon: Package, label: "Inventario", value: info.counts.inventory },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200/60 bg-white px-8 py-4 dark:border-white/[0.06] dark:bg-zinc-950">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">Centro de Controle</h1>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Dados & Backup</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none">
        <div className="mx-auto max-w-4xl px-8 py-6 space-y-8">

          {/* System Status Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatusCard icon={Database} label="Banco de Dados" value={formatBytes(info.db_size_bytes)} sub="guardian.db" color="text-indigo-600 dark:text-indigo-400" bg="bg-indigo-50 dark:bg-indigo-500/10" />
            <StatusCard icon={HardDrive} label="Armazenamento" value={formatBytes(info.storage_size_bytes)} sub="Documentos e fotos" color="text-blue-600 dark:text-blue-400" bg="bg-blue-50 dark:bg-blue-500/10" />
            <StatusCard icon={Clock} label="Ultima Modificacao" value={info.db_last_modified ? new Date(info.db_last_modified).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"} sub={info.config.backup_path ? `Espelho: ${info.config.backup_path}` : "Sem backup automatico"} color="text-emerald-600 dark:text-emerald-400" bg="bg-emerald-50 dark:bg-emerald-500/10" />
          </div>

          {/* Data counts */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-white/[0.06] dark:bg-zinc-900">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Registros no Sistema</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
              {statItems.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex flex-col items-center rounded-xl bg-slate-50/50 p-3 dark:bg-zinc-800/30">
                  <Icon size={16} strokeWidth={1.5} className="mb-1 text-slate-400 dark:text-zinc-500" />
                  <span className="text-xl font-bold tracking-tight text-slate-800 dark:text-zinc-200">{value}</span>
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm dark:border-white/[0.06] dark:bg-zinc-900">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Acoes</p>
            <div className="flex flex-wrap gap-3">
              <button onClick={downloadBackup} className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
                <Download size={14} strokeWidth={1.5} /> Baixar Backup Completo
              </button>
              <button onClick={() => setShowRestore(true)} className="flex items-center gap-2 rounded-xl border border-slate-200/60 bg-white px-5 py-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">
                <Upload size={14} strokeWidth={1.5} /> Restaurar Backup
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-2xl border border-red-200/60 bg-white p-6 shadow-sm dark:border-red-500/10 dark:bg-zinc-900">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle size={14} strokeWidth={1.5} className="text-red-500" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-500 dark:text-red-400">Zona de Perigo</p>
            </div>
            <p className="mb-4 text-xs text-slate-500 dark:text-zinc-500">
              Acoes irreversiveis. Certifique-se de ter um backup recente antes de prosseguir.
            </p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setShowFixStatus(true)} className="flex items-center gap-2 rounded-xl border border-red-200/60 bg-red-50 px-5 py-3 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20">
                <RotateCcw size={14} strokeWidth={1.5} /> Resetar Status de Unidades
              </button>
            </div>
          </div>
        </div>
      </div>

      <RestoreModal open={showRestore} onClose={() => setShowRestore(false)} />
      <ConfirmDangerModal
        open={showFixStatus}
        onClose={() => setShowFixStatus(false)}
        title="Resetar Status de Todas as Unidades"
        description='Todas as unidades serao marcadas como "Vazio". Esta acao nao pode ser desfeita.'
        confirmWord="CONFIRMAR"
        onConfirm={async () => { await api.fixAllStatus(); setShowFixStatus(false); fetchInfo(); }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status Card
// ---------------------------------------------------------------------------

function StatusCard({ icon: Icon, label, value, sub, color, bg }: {
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
      <p className="mt-0.5 truncate text-[10px] font-medium text-slate-400 dark:text-zinc-500">{sub}</p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Restore Modal
// ---------------------------------------------------------------------------

function RestoreModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [confirmText, setConfirmText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const canConfirm = confirmText === "RESTAURAR" && file;

  const submit = async () => {
    if (!canConfirm) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("backup_file", file);
      await fetch("/api/system/restore", { method: "POST", body: form });
      window.location.reload();
    } catch (err) { console.error(err); }
    finally { setUploading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Restaurar Backup">
      <div className="space-y-4">
        <div className="rounded-xl border border-red-200/60 bg-red-50/50 p-3 dark:border-red-500/10 dark:bg-red-500/5">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400">
            ATENCAO: Todos os dados atuais serao substituidos pelo backup. Esta acao e irreversivel.
          </p>
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Arquivo ZIP do backup</label>
          <input type="file" accept=".zip" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-300 dark:file:bg-zinc-700 dark:file:text-zinc-300" />
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
            Digite <span className="font-bold text-red-500">RESTAURAR</span> para confirmar
          </label>
          <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="RESTAURAR" className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-mono font-semibold text-slate-800 outline-none placeholder:text-slate-300 focus:border-red-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-600" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl px-5 py-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800">Cancelar</button>
          <button onClick={submit} disabled={!canConfirm || uploading} className="rounded-xl bg-red-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : "Restaurar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Generic Danger Confirm Modal
// ---------------------------------------------------------------------------

function ConfirmDangerModal({ open, onClose, title, description, confirmWord, onConfirm }: {
  open: boolean; onClose: () => void; title: string; description: string; confirmWord: string; onConfirm: () => void;
}) {
  const [text, setText] = useState("");
  const canConfirm = text === confirmWord;

  useEffect(() => { if (!open) setText(""); }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-zinc-400">{description}</p>
        <div>
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
            Digite <span className="font-bold text-red-500">{confirmWord}</span> para confirmar
          </label>
          <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={confirmWord} className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-mono font-semibold text-slate-800 outline-none placeholder:text-slate-300 focus:border-red-400 dark:border-white/[0.06] dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-600" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl px-5 py-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800">Cancelar</button>
          <button onClick={() => { if (canConfirm) onConfirm(); }} disabled={!canConfirm} className="rounded-xl bg-red-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">Executar</button>
        </div>
      </div>
    </Modal>
  );
}
